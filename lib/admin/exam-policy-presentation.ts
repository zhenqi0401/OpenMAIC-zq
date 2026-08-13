import type { AdminExamPolicy, ExamPolicyInput } from '@/lib/admin/client';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export interface ExamCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ExamPolicyDraft {
  title: string;
  targetRoleId: string;
  categoryIds: string[];
  courseIds: string[];
  questionCount: number;
  passThreshold: number;
  timeLimitMinutes: string;
}

export interface ExamReadiness {
  publishedCourseCount: number;
  readyCourseCount: number;
  missingQuestionCourseCount: number;
}

export function createEmptyPolicyDraft(targetRoleId = '', categoryId = ''): ExamPolicyDraft {
  return {
    title: '',
    targetRoleId,
    categoryIds: categoryId ? [categoryId] : [],
    courseIds: [],
    questionCount: 20,
    passThreshold: 80,
    timeLimitMinutes: '45',
  };
}

export function toPolicyDraft(policy: AdminExamPolicy): ExamPolicyDraft {
  return {
    title: policy.title,
    targetRoleId: policy.targetRoleId,
    categoryIds: [...policy.categoryIds],
    courseIds: [...policy.courseIds],
    questionCount: policy.questionCount,
    passThreshold: policy.passThreshold,
    timeLimitMinutes: policy.timeLimitMinutes ? String(policy.timeLimitMinutes) : '',
  };
}

export function toPolicyInput(draft: ExamPolicyDraft): ExamPolicyInput {
  return {
    title: draft.title.trim(),
    targetRoleId: draft.targetRoleId,
    categoryIds: draft.categoryIds,
    courseIds: draft.courseIds,
    questionCount: draft.questionCount,
    passThreshold: draft.passThreshold,
    timeLimitMinutes: draft.timeLimitMinutes ? Number(draft.timeLimitMinutes) : null,
  };
}

export function getExamReadiness(courses: readonly EnterpriseCourse[]): ExamReadiness {
  const publishedCourses = courses.filter((course) => course.status === 'published');
  const readyCourseCount = publishedCourses.filter(
    (course) => (course.assessmentQuestionCount ?? course.assessmentQuestions.length) > 0,
  ).length;
  return {
    publishedCourseCount: publishedCourses.length,
    readyCourseCount,
    missingQuestionCourseCount: publishedCourses.length - readyCourseCount,
  };
}

export function countDraftCandidateQuestions(
  courses: readonly EnterpriseCourse[],
  draft: ExamPolicyDraft,
) {
  const selectedCourseIds = new Set(draft.courseIds);
  return courses
    .filter(
      (course) =>
        course.status === 'published' &&
        draft.categoryIds.includes(course.categoryId) &&
        (selectedCourseIds.size === 0 || selectedCourseIds.has(course.id)),
    )
    .reduce(
      (total, course) =>
        total + (course.assessmentQuestionCount ?? course.assessmentQuestions.length),
      0,
    );
}

export function getPolicyStatusView(status: AdminExamPolicy['status']) {
  return {
    draft: { label: '草稿', tone: 'warning' },
    published: { label: '已发布', tone: 'success' },
    archived: { label: '已归档', tone: 'neutral' },
  }[status] as {
    label: string;
    tone: 'neutral' | 'success' | 'warning';
  };
}

export function getPolicyMenuLabels(status: AdminExamPolicy['status']) {
  if (status === 'draft') return ['发布', '删除'] as const;
  if (status === 'published') return ['下架'] as const;
  return ['重新发布'] as const;
}

export function getPolicyScopeSummary(
  policy: Pick<AdminExamPolicy, 'categoryIds' | 'courseIds'>,
  categoryNames: ReadonlyMap<string, string>,
) {
  // 分类可能已被删除：查不到名字时显示「已删除分类」，避免暴露原始 id
  const categories = policy.categoryIds
    .map((id) => categoryNames.get(id) ?? '已删除分类')
    .join('、');
  const courseScope =
    policy.courseIds.length === 0 ? '分类下全部课程' : `指定 ${policy.courseIds.length} 门课程`;
  return `${categories || '未选分类'} · ${courseScope}`;
}
