import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('course completion assessment gate', () => {
  test('binds the assessment course id to the classroom loaded from storage', () => {
    const source = readFileSync('app/classroom/[id]/page.tsx', 'utf8');

    expect(source).toContain('resolveStageCourseStorageId(');
    expect(source).not.toContain('restoreGeneratedCourseId');
  });

  test('saves completed learning progress before loading the assessment', () => {
    const source = readFileSync('components/assessment/CourseAssessmentPanel.tsx', 'utf8');
    const progressCheck = source.indexOf('if (!progressResponse.ok)');
    const assessmentRequest = source.indexOf('/assessment`');

    expect(progressCheck).toBeGreaterThan(-1);
    expect(assessmentRequest).toBeGreaterThan(progressCheck);
  });

  test('treats an empty assessment as generation in progress instead of completed answers', () => {
    const source = readFileSync('components/assessment/CourseAssessmentPanel.tsx', 'utf8');

    expect(source).toContain('assessment.questions.length > 0');
    expect(source).toContain('课后测评生成中');
    expect(source).toContain('loadAssessment(false)');
  });

  test('shows course completion only after the assessment passes', () => {
    const source = readFileSync('components/canvas/canvas-area.tsx', 'utf8');

    expect(source).toContain('!assessmentPassed');
    expect(source).toContain('<CourseAssessmentPanel');
    expect(source).toContain('<ClassroomCompletePageConnected />');
  });
});
