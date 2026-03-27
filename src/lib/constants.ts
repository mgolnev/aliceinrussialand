export const POST_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type PostStatusValue = (typeof POST_STATUS)[keyof typeof POST_STATUS];
