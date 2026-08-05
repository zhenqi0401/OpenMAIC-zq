export const SYSTEM_COURSE_CATEGORIES = [
  { categoryKey: 'management', name: '管理知识培训', sortOrder: 10 },
  { categoryKey: 'professional', name: '专业知识培训', sortOrder: 20 },
  { categoryKey: 'tob-sales', name: 'ToB销售培训', sortOrder: 30 },
  { categoryKey: 'toc-sales', name: 'ToC销售培训', sortOrder: 40 },
  { categoryKey: 'company-policy', name: '公司制度培训', sortOrder: 50 },
] as const;

export type SystemCourseCategoryKey = (typeof SYSTEM_COURSE_CATEGORIES)[number]['categoryKey'];

const SYSTEM_CATEGORY_KEYS = new Set<string>(
  SYSTEM_COURSE_CATEGORIES.map((category) => category.categoryKey),
);

export function isSystemCourseCategoryKey(value: unknown): value is SystemCourseCategoryKey {
  return typeof value === 'string' && SYSTEM_CATEGORY_KEYS.has(value);
}
