import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export function filterExamScopeCourses(
  courses: readonly EnterpriseCourse[],
  categoryIds: readonly string[],
): EnterpriseCourse[] {
  return courses.filter(
    (course) => course.status === 'published' && categoryIds.includes(course.categoryId),
  );
}

export function examCourseScopeLabel(courseIds: readonly string[]): string {
  return courseIds.length === 0 ? '使用所选分类下全部课程' : `已选 ${courseIds.length} 门`;
}

export function toggleExamCourseSelection(
  courseIds: readonly string[],
  courseId: string,
): string[] {
  return courseIds.includes(courseId)
    ? courseIds.filter((candidate) => candidate !== courseId)
    : [...courseIds, courseId];
}

export function changeExamCategoryScope(
  categoryIds: readonly string[],
  _courseIds: readonly string[],
  categoryId: string,
) {
  return {
    categoryIds: categoryIds.includes(categoryId)
      ? categoryIds.filter((candidate) => candidate !== categoryId)
      : [...categoryIds, categoryId],
    courseIds: [],
  };
}
