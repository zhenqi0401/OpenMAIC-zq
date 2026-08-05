import { describe, expect, it } from 'vitest';
import {
  applyAuditFindings,
  buildAuditSourceCatalog,
  normalizeOutlineAuditModelOutput,
  OutlineAuditValidationError,
} from '@/lib/generation/outline-audit';
import {
  canConfirmWithOutlineAudit,
  completeOutlineAudit,
  createRunningOutlineAudit,
  markAuditFindingsApplied,
  rejectRemainingAuditFindings,
  skipOutlineAudit,
  staleOutlineAudit,
} from '@/lib/generation/outline-audit-state';
import type { OutlineAuditFinding, OutlineAuditResult } from '@/lib/generation/outline-audit-types';
import type { SceneOutline, UserRequirements } from '@/lib/types/generation';
import { normalizeRestoredGenerationSession } from '@/app/generation-preview/outline-audit-session';

function scene(id: string, order: number, overrides: Partial<SceneOutline> = {}): SceneOutline {
  return {
    id,
    order,
    type: 'slide',
    title: `场景 ${id}`,
    description: `场景 ${id} 的说明`,
    keyPoints: [`要点 ${id}`],
    ...overrides,
  };
}

function context(
  requirements: UserRequirements = {
    requirement: '课程必须包含一次 Quiz。',
    trainingCourseType: 'other',
  },
) {
  return {
    requirements,
    trustedSources: buildAuditSourceCatalog({ requirement: requirements.requirement }),
  };
}

function rawFinding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'finding-1',
    severity: 'warning',
    category: 'internal_conflict',
    relatedSceneIds: ['s1'],
    reason: '当前标题与场景说明互相冲突。',
    evidence: [],
    before: '标题和说明冲突',
    after: '标题和说明一致',
    operations: [],
    ...overrides,
  };
}

function normalizedFindings(
  outlines: SceneOutline[],
  findings: Array<Record<string, unknown>>,
  requirements?: UserRequirements,
) {
  return normalizeOutlineAuditModelOutput(
    { verdict: 'changes_proposed', summary: '发现需要处理的问题。', findings },
    outlines,
    context(requirements),
  ).findings;
}

describe('outline audit source and model contracts', () => {
  it('returns pass without changing a valid outline', () => {
    const outlines = [scene('s1', 1)];
    const normalized = normalizeOutlineAuditModelOutput(
      { verdict: 'pass', summary: '未发现有证据支持的问题。', findings: [] },
      outlines,
      context({ requirement: '普通课程', trainingCourseType: 'other' }),
    );
    expect(normalized.verdict).toBe('pass');
    expect(normalized.findings).toEqual([]);
    expect(outlines).toEqual([scene('s1', 1)]);
  });

  it('builds WEB IDs only from server-returned excerpts that match known source URLs', () => {
    const catalog = buildAuditSourceCatalog({
      requirement: '核对新政策',
      researchContext:
        '摘要\n\nSources:\n- [政策页面](https://example.com/policy): 该政策自 7 月起生效。',
      researchSources: [
        { title: '政策页面', url: 'https://example.com/policy' },
        { title: '无正文页面', url: 'https://example.com/missing' },
      ],
    });
    expect(catalog.find((source) => source.sourceId === 'WEB-001')?.excerpt).toContain(
      '该政策自 7 月起生效',
    );
    expect(catalog.some((source) => source.sourceId === 'WEB-002')).toBe(false);
  });

  it('rejects fabricated citations and protected insert fields', () => {
    const outlines = [scene('s1', 1)];
    expect(() =>
      normalizedFindings(outlines, [
        rawFinding({
          category: 'requirement_omission',
          evidence: [{ sourceId: 'REQ-999' }],
        }),
      ]),
    ).toThrow(OutlineAuditValidationError);

    expect(() =>
      normalizedFindings(outlines, [
        rawFinding({
          operations: [
            {
              type: 'insert_scene',
              afterSceneId: 's1',
              scene: {
                id: 'model-controlled-id',
                order: 99,
                type: 'slide',
                title: '新增',
                description: '新增说明',
                keyPoints: ['新增要点'],
              },
            },
          ],
        }),
      ]),
    ).toThrow(/protected or unknown fields/);
  });

  it('rejects procedural-skill and conflicting operations across findings', () => {
    const outlines = [scene('s1', 1), scene('s2', 2)];
    expect(() =>
      normalizedFindings(outlines, [
        rawFinding({
          operations: [
            {
              type: 'change_scene_type',
              sceneId: 's1',
              newType: 'interactive',
              config: { widgetType: 'procedural-skill', widgetOutline: { task: '执行' } },
            },
          ],
        }),
      ]),
    ).toThrow(/invalid or forbidden/);

    expect(() =>
      normalizedFindings(outlines, [
        rawFinding({
          id: 'finding-1',
          operations: [{ type: 'update_field', sceneId: 's1', field: 'title', value: '标题 A' }],
        }),
        rawFinding({
          id: 'finding-2',
          operations: [{ type: 'update_field', sceneId: 's1', field: 'title', value: '标题 B' }],
        }),
      ]),
    ).toThrow(/conflict/);
  });
});

describe('outline audit atomic patch application', () => {
  it('applies update, insertion, and movement atomically with stable IDs and contiguous order', () => {
    const requirements: UserRequirements = { requirement: '普通课程', trainingCourseType: 'other' };
    const outlines = [scene('s1', 1), scene('s2', 2)];
    const findings = normalizedFindings(
      outlines,
      [
        rawFinding({
          id: 'update',
          operations: [
            { type: 'update_field', sceneId: 's1', field: 'title', value: '修正后的标题' },
          ],
        }),
        rawFinding({
          id: 'insert',
          operations: [
            {
              type: 'insert_scene',
              afterSceneId: 's1',
              scene: {
                type: 'quiz',
                title: '知识检查',
                description: '检查学习结果',
                keyPoints: ['检查概念'],
                quizConfig: {
                  questionCount: 3,
                  difficulty: 'medium',
                  questionTypes: ['single'],
                },
              },
            },
          ],
        }),
        rawFinding({
          id: 'move',
          operations: [{ type: 'move_scene', sceneId: 's2', afterSceneId: null }],
        }),
      ],
      requirements,
    );
    const patched = applyAuditFindings(
      outlines,
      findings,
      ['update', 'insert', 'move'],
      context(requirements),
    );
    expect(patched.map((item) => item.id)).toEqual(['s2', 's1', expect.stringMatching(/^audit_/)]);
    expect(patched.map((item) => item.order)).toEqual([1, 2, 3]);
    expect(patched[1].title).toBe('修正后的标题');
    expect(patched[2].quizConfig?.questionCount).toBe(3);
    expect(patched.some((item) => item.trainingCourseType || item.sourceEvidence)).toBe(false);
    expect(outlines.map((item) => item.id)).toEqual(['s1', 's2']);
  });

  it('rebuilds enhanced evidence from trusted REQ/DOC IDs and refuses evidence-free insertion', () => {
    const requirements: UserRequirements = {
      requirement: '退款金额超过 5000 元必须复核。',
      trainingCourseType: 'company_policy',
    };
    const auditContext = context(requirements);
    const req = auditContext.trustedSources[0];
    const outlines = [
      scene('s1', 1, {
        trainingCourseType: 'company_policy',
        teachingBrief: { mustCover: ['5000 元复核'] },
        sourceEvidence: [
          { id: req.sourceId, kind: 'requirement', label: req.label, excerpt: req.excerpt },
        ],
      }),
    ];
    expect(() =>
      normalizedFindings(
        outlines,
        [
          rawFinding({
            operations: [
              {
                type: 'insert_scene',
                afterSceneId: 's1',
                scene: {
                  type: 'slide',
                  title: '复核示例',
                  description: '展示复核流程',
                  keyPoints: ['复核'],
                  teachingBrief: { mustCover: ['5000 元复核'] },
                },
              },
            ],
          }),
        ],
        requirements,
      ),
    ).toThrow(/without trusted requirement or document evidence/);

    const findings = normalizedFindings(
      outlines,
      [
        rawFinding({
          operations: [
            {
              type: 'insert_scene',
              afterSceneId: 's1',
              sourceRefIds: [req.sourceId],
              scene: {
                type: 'slide',
                title: '复核示例',
                description: '展示复核流程',
                keyPoints: ['复核'],
                teachingBrief: { mustCover: ['5000 元复核'] },
              },
            },
          ],
        }),
      ],
      requirements,
    );
    const patched = applyAuditFindings(outlines, findings, ['finding-1'], auditContext);
    expect(patched[1].sourceEvidence).toEqual([
      { id: req.sourceId, kind: 'requirement', label: req.label, excerpt: req.excerpt },
    ]);
    expect(patched[1].trainingCourseType).toBe('company_policy');
  });

  it('refuses deletion of the final scene and the last explicitly required Quiz', () => {
    const single = [scene('s1', 1)];
    expect(() =>
      normalizedFindings(
        single,
        [rawFinding({ operations: [{ type: 'delete_scene', sceneId: 's1' }] })],
        { requirement: '普通课程', trainingCourseType: 'other' },
      ),
    ).toThrow(/final scene/);

    const outlines = [
      scene('s1', 1),
      scene('quiz', 2, {
        type: 'quiz',
        quizConfig: { questionCount: 1, difficulty: 'easy', questionTypes: ['single'] },
      }),
    ];
    expect(() =>
      normalizedFindings(outlines, [
        rawFinding({
          relatedSceneIds: ['quiz'],
          operations: [{ type: 'delete_scene', sceneId: 'quiz' }],
        }),
      ]),
    ).toThrow(/last explicitly required Quiz/);
  });

  it('never permits the other strategy to gain teachingBrief', () => {
    const outlines = [scene('s1', 1)];
    expect(() =>
      normalizedFindings(
        outlines,
        [
          rawFinding({
            operations: [
              {
                type: 'update_field',
                sceneId: 's1',
                field: 'teachingBrief.mustCover',
                value: ['不得出现'],
              },
            ],
          }),
        ],
        { requirement: '普通课程', trainingCourseType: 'other' },
      ),
    ).toThrow(/cannot add fidelity fields/);
  });

  it('requires trusted REQ/DOC evidence for enhanced must-cover changes', () => {
    const requirements: UserRequirements = {
      requirement: '退款金额超过 5000 元必须复核。',
      trainingCourseType: 'company_policy',
    };
    const auditContext = context(requirements);
    const req = auditContext.trustedSources[0];
    const outlines = [
      scene('s1', 1, {
        trainingCourseType: 'company_policy',
        teachingBrief: { mustCover: ['5000 元复核'] },
        sourceEvidence: [
          { id: req.sourceId, kind: 'requirement', label: req.label, excerpt: req.excerpt },
        ],
      }),
    ];
    expect(() =>
      normalizedFindings(
        outlines,
        [
          rawFinding({
            operations: [
              {
                type: 'update_field',
                sceneId: 's1',
                field: 'teachingBrief.mustCover',
                value: ['5000 元复核并记录'],
              },
            ],
          }),
        ],
        requirements,
      ),
    ).toThrow(/without trusted requirement or document evidence/);
  });

  it('protects the first cover from deletion, movement, insertion before it, and type changes', () => {
    const cover = scene('cover', 1, {
      sceneRole: 'cover',
      title: '公平理论',
      coverBrief: {
        subtitle: '从公平感知理解团队投入与回报',
        attribution: '约翰·斯泰西·亚当斯',
        narrationPoints: ['形成背景', '公平感知问题', '课程切入方向'],
      },
    });
    const outlines = [cover, scene('s2', 2)];
    const operations = [
      [{ type: 'delete_scene', sceneId: 'cover' }],
      [{ type: 'move_scene', sceneId: 'cover', afterSceneId: 's2' }],
      [
        {
          type: 'insert_scene',
          afterSceneId: null,
          scene: {
            type: 'slide',
            title: '插入页',
            description: '试图放到封面前',
            keyPoints: ['插入'],
          },
        },
      ],
      [
        {
          type: 'change_scene_type',
          sceneId: 'cover',
          newType: 'quiz',
          config: {
            quizConfig: { questionCount: 1, difficulty: 'easy', questionTypes: ['single'] },
          },
        },
      ],
    ];

    for (const operationSet of operations) {
      expect(() =>
        normalizedFindings(
          outlines,
          [rawFinding({ relatedSceneIds: ['cover'], operations: operationSet })],
          {
            requirement: '公平理论知识课程',
            trainingCourseType: 'other',
          },
        ),
      ).toThrow(/first knowledge cover/);
    }
  });

  it('allows title and narration-point edits while preserving cover attribution', () => {
    const outlines = [
      scene('cover', 1, {
        sceneRole: 'cover',
        title: '公平理论入门',
        coverBrief: {
          subtitle: '从公平感知理解团队投入与回报',
          attribution: '约翰·斯泰西·亚当斯',
          narrationPoints: ['旧背景'],
        },
      }),
      scene('s2', 2),
    ];
    const findings = normalizedFindings(
      outlines,
      [
        rawFinding({
          relatedSceneIds: ['cover'],
          operations: [
            { type: 'update_field', sceneId: 'cover', field: 'title', value: '公平理论' },
            {
              type: 'update_field',
              sceneId: 'cover',
              field: 'coverBrief.narrationPoints',
              value: ['形成背景', '所回应的公平感知问题', '课程切入方向'],
              sourceRefIds: ['REQ-001'],
            },
          ],
        }),
      ],
      { requirement: '公平理论知识课程', trainingCourseType: 'other' },
    );
    const patched = applyAuditFindings(
      outlines,
      findings,
      ['finding-1'],
      context({ requirement: '公平理论知识课程', trainingCourseType: 'other' }),
    );
    expect(patched[0].title).toBe('公平理论');
    expect(patched[0].coverBrief).toEqual({
      subtitle: '从公平感知理解团队投入与回报',
      attribution: '约翰·斯泰西·亚当斯',
      narrationPoints: ['形成背景', '所回应的公平感知问题', '课程切入方向'],
    });
  });
});

describe('outline audit session state', () => {
  const result: OutlineAuditResult = {
    auditId: 'oa-1',
    baseRevision: 1,
    verdict: 'changes_proposed',
    summary: '两条建议',
    findings: [{ id: 'f1' } as OutlineAuditFinding, { id: 'f2' } as OutlineAuditFinding],
    providerId: 'deepseek',
    modelId: 'deepseek-v4-flash',
    completedAt: '2026-07-31T00:00:00.000Z',
  };

  it('gates confirmation through running, partial application, rejection, stale, and skip states', () => {
    expect(canConfirmWithOutlineAudit(createRunningOutlineAudit(1), 1)).toBe(false);
    const proposed = completeOutlineAudit(result);
    expect(canConfirmWithOutlineAudit(proposed, 1)).toBe(false);
    const partiallyApplied = markAuditFindingsApplied(proposed, ['f1'], 2);
    expect(partiallyApplied.status).toBe('changes_proposed');
    expect(partiallyApplied.baseRevision).toBe(2);
    expect(canConfirmWithOutlineAudit(partiallyApplied, 2)).toBe(false);
    const resolved = rejectRemainingAuditFindings(partiallyApplied);
    expect(resolved.status).toBe('resolved');
    expect(resolved.rejectedFindingIds).toEqual(['f2']);
    expect(canConfirmWithOutlineAudit(resolved, 2)).toBe(true);
    expect(canConfirmWithOutlineAudit(staleOutlineAudit(resolved), 3)).toBe(false);
    expect(canConfirmWithOutlineAudit(skipOutlineAudit(3), 3)).toBe(true);
    expect(canConfirmWithOutlineAudit(skipOutlineAudit(3), 4)).toBe(false);
  });

  it('upgrades old ordinary sessions into review while leaving excluded modes unchanged', () => {
    const oldSession = {
      sessionId: 'old',
      requirements: { requirement: '普通课程', trainingCourseType: 'other' as const },
      pdfText: '',
      sceneOutlines: [scene('s1', 1)],
      currentStep: 'complete' as const,
      previewPhase: 'generating-content' as const,
    };
    expect(normalizeRestoredGenerationSession(oldSession)).toMatchObject({
      outlineRevision: 1,
      previewPhase: 'review',
    });
    expect(
      normalizeRestoredGenerationSession({
        ...oldSession,
        requirements: { requirement: 'Interactive', interactiveMode: true },
      }).previewPhase,
    ).toBe('generating-content');
    expect(
      normalizeRestoredGenerationSession({ ...oldSession, taskEngineMode: true }).previewPhase,
    ).toBe('generating-content');
  });
});
