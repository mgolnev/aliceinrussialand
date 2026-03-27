import slugify from "slugify";
import { nanoid } from "nanoid";

export function toSlug(input: string) {
  const base = slugify(input.trim(), {
    lower: true,
    strict: true,
    locale: "ru",
  });
  return base || `post-${nanoid(6)}`;
}

export function draftSlug() {
  return `draft-${nanoid(10)}`;
}
