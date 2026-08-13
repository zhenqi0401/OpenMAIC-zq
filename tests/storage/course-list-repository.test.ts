import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('enterprise course list repository', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'lib/storage/enterprise-repository.ts'),
    'utf8',
  );

  test('aggregates and maps the real scene count for every course', () => {
    expect(source).toMatch(
      /sceneCount: count\(scenes\.id\)\.as\('scene_count'\)[\s\S]*?from\(scenes\)[\s\S]*?groupBy\(scenes\.courseId\)[\s\S]*?as\('course_scene_counts'\)/,
    );
    expect(source).toContain('.leftJoin(sceneCounts, eq(courses.id, sceneCounts.courseId))');
    expect(source).toContain('Number(row.sceneCount ?? 0)');
  });

  test('course summaries do not select full stage snapshots or assessment JSON', () => {
    const summaryMethod = source.slice(
      source.indexOf('async listCourseSummaries()'),
      source.indexOf('async getLearnerCourseMeta('),
    );
    expect(summaryMethod).not.toContain('stageSnapshot: courses.stageSnapshot');
    expect(summaryMethod).not.toContain('assessmentQuestions: courses.assessmentQuestions');
    expect(summaryMethod).toContain('jsonb_array_length(${courses.assessmentQuestions})');
  });
});
