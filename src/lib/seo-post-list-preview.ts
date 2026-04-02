import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import {
  firstSentence,
  stripLeadingTitleFromBody,
} from "@/lib/post-title-body-split";

const FALLBACK = "Откройте публикацию, чтобы прочитать полностью.";

/**
 * Заголовок и превью текста для SEO-списков (/category/…, /archive):
 * как на странице поста — первая фраза из title, описание без повтора в начале body.
 */
export function getSeoPostListPreviewParts(
  title: string,
  body: string,
  excerptMax = 220,
): { heading: string | null; excerpt: string } {
  const postTitle = title.trim();
  const bodyTrim = body.trim();

  if (postTitle) {
    const heading = firstSentence(postTitle);
    const rest = stripLeadingTitleFromBody(body, heading).trim();
    let excerpt = rest ? excerptForMetaDescription(rest, excerptMax) : "";
    if (!excerpt && bodyTrim) {
      excerpt = excerptForMetaDescription(bodyTrim, excerptMax);
    }
    if (!excerpt) excerpt = FALLBACK;
    return { heading, excerpt };
  }

  if (!bodyTrim) {
    return { heading: null, excerpt: FALLBACK };
  }

  const excerpt =
    excerptForMetaDescription(bodyTrim, excerptMax) || FALLBACK;
  return { heading: null, excerpt };
}
