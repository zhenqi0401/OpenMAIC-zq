export interface GeneratedCourseDraftInput {
  stage: {
    id: string;
    name?: string | null;
    description?: string | null;
  };
  categoryId: string;
  scenes: unknown[];
  outlines: unknown[];
}

export interface GeneratedCourseDraft {
  course: {
    name: string;
    description: string | null;
    categoryId: string;
  };
  content: {
    scenes: unknown[];
    outlines: unknown[];
  };
}

export type CourseDraftFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface ApiEnvelope {
  success?: boolean;
  error?: string;
  course?: unknown;
  content?: unknown;
}

export function shouldShowAssessmentMismatchWarning(assessmentQuestions?: unknown[] | null) {
  return Array.isArray(assessmentQuestions) && assessmentQuestions.length > 0;
}

export function buildGeneratedCourseDraft(input: GeneratedCourseDraftInput): GeneratedCourseDraft {
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error('categoryId is required');

  const stageName = input.stage.name?.trim();
  return {
    course: {
      name: stageName || input.stage.id,
      description: input.stage.description?.trim() || null,
      categoryId,
    },
    content: {
      scenes: input.scenes,
      outlines: input.outlines,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCourseId(course: unknown): string | null {
  if (!isRecord(course)) return null;
  return typeof course.id === 'string' && course.id.trim() ? course.id : null;
}

async function readApiEnvelope(response: Response): Promise<ApiEnvelope> {
  try {
    const body = (await response.json()) as unknown;
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

async function assertAdminApiSuccess(response: Response, action: string): Promise<ApiEnvelope> {
  const body = await readApiEnvelope(response);
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.error === 'string' ? body.error : `${action} failed`);
  }
  return body;
}

export async function replaceGeneratedCourseDraftContent(
  fetcher: CourseDraftFetcher,
  courseId: string,
  content: GeneratedCourseDraft['content'],
) {
  const response = await fetcher(`/api/admin/courses/${encodeURIComponent(courseId)}/content`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  });
  return assertAdminApiSuccess(response, 'Saving generated course content');
}

export async function persistGeneratedCourseDraft(
  fetcher: CourseDraftFetcher,
  input: GeneratedCourseDraftInput,
) {
  const draft = buildGeneratedCourseDraft(input);
  const createResponse = await fetcher('/api/admin/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft.course),
  });
  const created = await assertAdminApiSuccess(createResponse, 'Creating generated course draft');
  const courseId = getCourseId(created.course);
  if (!courseId) throw new Error('Creating generated course draft failed');

  const savedContent = await replaceGeneratedCourseDraftContent(fetcher, courseId, draft.content);
  return {
    course: created.course,
    content: savedContent.content,
  };
}
