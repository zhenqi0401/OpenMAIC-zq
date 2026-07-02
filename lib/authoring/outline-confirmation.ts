export interface OutlineConfirmationInput {
  reviewOutlineEnabled: boolean;
  userOpenedReviewEarly: boolean;
}

export function shouldPauseForOutlineConfirmation(_input: OutlineConfirmationInput): boolean {
  return true;
}
