export interface CourseAuthoringIdentity {
  isAdmin: boolean;
}

export interface CourseSessionLike {
  authenticated?: boolean;
  identity?: CourseAuthoringIdentity | null;
}

export function canManageCourses(session: CourseSessionLike | null | undefined): boolean {
  return session?.authenticated === true && session.identity?.isAdmin === true;
}

export function shouldAllowProModeEntry(input: {
  isSceneEditable: boolean;
  identity?: CourseAuthoringIdentity | null;
}): boolean {
  return input.isSceneEditable && input.identity?.isAdmin === true;
}
