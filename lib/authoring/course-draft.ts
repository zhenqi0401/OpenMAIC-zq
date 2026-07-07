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

export interface GeneratedCourseDraftMetadataInput {
  stage: GeneratedCourseDraftInput['stage'];
  categoryId: string;
}

export interface GeneratedCourseDraft {
  course: {
    name: string;
    description: string | null;
    categoryId: string;
    stageSnapshot: GeneratedCourseDraftInput['stage'];
    generationStatus: 'generating';
    generationComplete: false;
  };
  content: {
    scenes: unknown[];
    outlines: unknown[];
  };
}

export interface GeneratedCourseDraftContentInput {
  scenes: unknown[];
  outlines: unknown[];
  stage?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
}

export interface ImportedClassroomEnterpriseInput {
  stage: GeneratedCourseDraftMetadataInput['stage'];
  categoryId: string;
  scenes: unknown[];
}

export type CourseDraftFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface RegenerateCourseAssessmentRequest {
  questionCount?: number;
  languageDirective?: string;
  thinkingConfig?: unknown;
}

interface ApiEnvelope {
  success?: boolean;
  error?: string;
  details?: string;
  course?: unknown;
  content?: unknown;
}

export function shouldShowAssessmentMismatchWarning(assessmentQuestions?: unknown[] | null) {
  return Array.isArray(assessmentQuestions) && assessmentQuestions.length > 0;
}

export function generatedCourseClassroomPath(stageId: string, courseId?: string | null): string {
  return `/classroom/${encodeURIComponent(courseId || stageId)}`;
}

export type CourseStorageFailureReason =
  | 'missing-category'
  | 'unauthenticated'
  | 'forbidden'
  | 'audio-storage'
  | 'database-write';

export function classifyCourseStorageFailure(error: unknown): CourseStorageFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('category')) return 'missing-category';
  if (normalized.includes('session') || normalized.includes('login')) return 'unauthenticated';
  if (
    normalized.includes('admin') ||
    normalized.includes('forbidden') ||
    normalized.includes('unauthorized')
  ) {
    return 'forbidden';
  }
  if (normalized.includes('audio')) return 'audio-storage';
  return 'database-write';
}

export function buildGeneratedCourseDraft(input: GeneratedCourseDraftInput): GeneratedCourseDraft {
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error('categoryId is required');

  const stageName = input.stage.name?.trim();
  const stageDescription = input.stage.description?.trim() || null;
  return {
    course: {
      name: stageName || input.stage.id,
      description: stageDescription,
      categoryId,
      stageSnapshot: {
        id: input.stage.id,
        name: stageName || input.stage.id,
        description: stageDescription,
      },
      generationStatus: 'generating',
      generationComplete: false,
    },
    content: {
      scenes: input.scenes,
      outlines: input.outlines,
    },
  };
}

export function applyCourseTitleToGeneratedStage(
  stage: GeneratedCourseDraftInput['stage'],
  courseTitle?: string | null,
) {
  const title = courseTitle?.trim();
  if (title) stage.name = title;
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
    const error = typeof body.error === 'string' ? body.error : `${action} failed`;
    const details = typeof body.details === 'string' ? body.details : '';
    throw new Error(details ? `${error}: ${details}` : error);
  }
  return body;
}

export async function replaceGeneratedCourseDraftContent(
  fetcher: CourseDraftFetcher,
  courseId: string,
  content: GeneratedCourseDraftContentInput,
) {
  const response = await fetcher(`/api/admin/courses/${encodeURIComponent(courseId)}/content`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  });
  return assertAdminApiSuccess(response, 'Saving generated course content');
}

export async function createGeneratedCourseDraft(
  fetcher: CourseDraftFetcher,
  input: GeneratedCourseDraftMetadataInput,
) {
  const draft = buildGeneratedCourseDraft({ ...input, scenes: [], outlines: [] });
  const createResponse = await fetcher('/api/admin/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft.course),
  });
  return assertAdminApiSuccess(createResponse, 'Creating generated course draft');
}

export async function regenerateGeneratedCourseAssessment(
  fetcher: CourseDraftFetcher,
  courseId: string,
  body: RegenerateCourseAssessmentRequest = {},
  headers: HeadersInit = {},
) {
  const response = await fetcher(
    `/api/admin/courses/${encodeURIComponent(courseId)}/assessment/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
  );
  return assertAdminApiSuccess(response, 'Generating post-course assessment');
}

export async function persistGeneratedCourseDraft(
  fetcher: CourseDraftFetcher,
  input: GeneratedCourseDraftInput,
) {
  const draft = buildGeneratedCourseDraft(input);
  const created = await createGeneratedCourseDraft(fetcher, input);
  const courseId = getCourseId(created.course);
  if (!courseId) throw new Error('Creating generated course draft failed');

  const savedContent = await replaceGeneratedCourseDraftContent(fetcher, courseId, draft.content);
  return {
    course: created.course,
    content: savedContent.content,
  };
}

function buildImportedOutlines(scenes: unknown[]) {
  return scenes.map((scene, index) => {
    const record = scene && typeof scene === 'object' ? (scene as Record<string, unknown>) : {};
    return {
      id: typeof record.id === 'string' ? record.id : `scene-${index + 1}`,
      title: typeof record.title === 'string' ? record.title : `Scene ${index + 1}`,
      order: typeof record.order === 'number' ? record.order : index,
      type: typeof record.type === 'string' ? record.type : 'slide',
    };
  });
}

export async function persistImportedClassroomToEnterprise(
  fetcher: CourseDraftFetcher,
  input: ImportedClassroomEnterpriseInput,
) {
  const created = await createGeneratedCourseDraft(fetcher, {
    stage: input.stage,
    categoryId: input.categoryId,
  });
  const courseId = getCourseId(created.course);
  if (!courseId) throw new Error('Creating imported course failed');

  const savedContent = await replaceGeneratedCourseDraftContent(fetcher, courseId, {
    scenes: input.scenes,
    outlines: buildImportedOutlines(input.scenes),
    stage: input.stage,
    generationStatus: 'ready',
    generationComplete: true,
  });
  return {
    course: created.course,
    content: savedContent.content,
  };
}
