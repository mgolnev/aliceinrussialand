import { isWanderNextLabel, type WanderNextLabel } from "./wander-labels";

/** Small, public-only catalogue. No post bodies or admin fields reach the client. */
export type WanderImage = {
  id: string;
  src: string;
  thumbnail: string;
  alt: string;
  width: number | null;
  height: number | null;
};

export type WanderPost = {
  id: string;
  slug: string;
  title: string;
  images: WanderImage[];
  projectIds: string[];
};

export type WanderProject = { id: string; slug: string; title: string; postIds: string[] };
export type WanderCatalogue = { posts: WanderPost[]; projects: WanderProject[] };
export type WanderStep = { postId: string; projectId?: string; imageId?: string; nextLabel?: WanderNextLabel };
export type WanderJourney = {
  /** Все предложенные работы: они не повторяются, даже если картинка сломана. */
  steps: WanderStep[];
  /** Только работы, изображение которых действительно загрузилось. */
  viewedPostIds: string[];
  cursor: number;
  /** Число просмотренных работ на последнем отмеченном рубеже выставки. */
  exhibitionSeenAt: number;
};
export const WANDER_STORAGE_KEY = "alice:wander:v1";
export const WANDER_RECENT_IMAGES_KEY = "alice:wander:recent-images:v1";
export const WANDER_RECENT_IMAGES_LIMIT = 24;
const WANDER_PROJECT_CHAOS_BAND = 5;
const WANDER_POST_CHAOS_BAND = 4;
const WANDER_CONTRAST_WEIGHTS = [1, .65, .4, .25] as const;
const WANDER_IGNORED_TOKENS = new Set([
  "для", "или", "как", "это", "что", "вот", "ещё", "уже", "при", "про", "под",
  "работа", "работы", "рисунок", "рисунка", "смотреть", "новая", "новый", "сегодня",
]);

function sample<T>(items: T[], random: () => number): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function sampleTop<T>(
  items: T[],
  score: (item: T) => number,
  band: number,
  random: () => number,
): T | undefined {
  if (!items.length) return undefined;
  const scored = items.map((item) => ({ item, score: score(item) }));
  const best = Math.max(...scored.map((item) => item.score));
  return sample(scored.filter((item) => item.score >= best - band).map((item) => item.item), random);
}

type WanderReference = { post: WanderPost; image: WanderImage; projectId?: string };

function aspectRatio(image: WanderImage): number | null {
  return image.width && image.height ? image.width / image.height : null;
}

function orientation(image: WanderImage): "portrait" | "landscape" | "square" | "unknown" {
  const ratio = aspectRatio(image);
  if (ratio === null) return "unknown";
  if (ratio < .87) return "portrait";
  if (ratio > 1.15) return "landscape";
  return "square";
}

function orientationContrast(left: WanderImage, right: WanderImage): number {
  const leftOrientation = orientation(left);
  const rightOrientation = orientation(right);
  if (leftOrientation === "unknown" || rightOrientation === "unknown") return 0;
  if (leftOrientation === rightOrientation) return -3;
  if (leftOrientation === "square" || rightOrientation === "square") return 4;
  return 9;
}

function textTokens(value: string): Set<string> {
  return new Set((value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length >= 3 && !WANDER_IGNORED_TOKENS.has(token)));
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / new Set([...left, ...right]).size;
}

function sharesProject(left: WanderPost, right: WanderPost): boolean {
  const rightProjects = new Set(right.projectIds);
  return left.projectIds.some((projectId) => rightProjects.has(projectId));
}

function referenceTokens(reference: WanderReference, projectTitles: Map<string, string>): Set<string> {
  return textTokens([
    reference.post.title,
    reference.image.alt,
    ...reference.post.projectIds.map((id) => projectTitles.get(id) ?? ""),
  ].join(" "));
}

function contrastScore(
  post: WanderPost,
  image: WanderImage,
  references: readonly WanderReference[],
  projectTitles: Map<string, string>,
): number {
  const candidateTokens = referenceTokens({ post, image }, projectTitles);
  return references.slice(0, WANDER_CONTRAST_WEIGHTS.length).reduce((score, reference, index) => {
    const weight = WANDER_CONTRAST_WEIGHTS[index]!;
    const leftRatio = aspectRatio(image);
    const rightRatio = aspectRatio(reference.image);
    const aspectDistance = leftRatio && rightRatio
      ? Math.min(1.4, Math.abs(Math.log(leftRatio / rightRatio))) * 4
      : 0;
    const projectDistance = sharesProject(post, reference.post) ? -8 : 6;
    const semanticPenalty = tokenSimilarity(candidateTokens, referenceTokens(reference, projectTitles)) * 8;
    return score + (projectDistance + orientationContrast(image, reference.image) + aspectDistance - semanticPenalty) * weight;
  }, 0);
}

/** The first image is usually a cover: keep it possible, but deliberately rare. */
export function pickWanderImage(
  images: WanderImage[],
  recentImageIds: readonly string[] = [],
  random: () => number = Math.random,
  contrastWith?: WanderImage,
): WanderImage | undefined {
  if (!images.length) return undefined;
  const recent = new Set(recentImageIds);
  const fresh = images.filter((image) => !recent.has(image.id));
  let candidates = fresh.length ? fresh : images;
  if (contrastWith) {
    const contrasting = candidates.filter((image) => orientationContrast(image, contrastWith) > 0);
    if (contrasting.length) candidates = contrasting;
  }
  if (candidates.length === 1) return candidates[0];

  const weights = candidates.map((image) => {
    const coverWeight = image.id === images[0]?.id ? 0.1 : 1;
    if (!contrastWith) return coverWeight;
    const leftRatio = aspectRatio(image);
    const rightRatio = aspectRatio(contrastWith);
    const aspectDistance = leftRatio && rightRatio
      ? 1 + Math.min(2, Math.abs(Math.log(leftRatio / rightRatio)))
      : 1;
    return coverWeight * aspectDistance;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < candidates.length; index++) {
    cursor -= weights[index]!;
    if (cursor < 0) return candidates[index];
  }
  return candidates.at(-1);
}

export function restoreWanderRecentImages(raw: string | null, catalogue: WanderCatalogue): string[] {
  if (!raw || raw.length > 20_000) return [];
  try {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    const available = new Set(catalogue.posts.flatMap((post) => post.images.map((image) => image.id)));
    const restored: string[] = [];
    for (const value of saved) {
      if (typeof value !== "string" || !available.has(value) || restored.includes(value)) continue;
      restored.push(value);
      if (restored.length >= WANDER_RECENT_IMAGES_LIMIT) break;
    }
    return restored;
  } catch {
    return [];
  }
}

export function rememberWanderImage(recentImageIds: readonly string[], imageId: string): string[] {
  return [imageId, ...recentImageIds.filter((id) => id !== imageId)]
    .slice(0, WANDER_RECENT_IMAGES_LIMIT);
}

/**
 * Contrast first, chance second. The algorithm avoids the recent visual/project
 * neighbourhood, then picks randomly inside a narrow band of equally strange options.
 */
export function nextWanderStep(
  catalogue: WanderCatalogue,
  visited: WanderStep[],
  current?: WanderStep,
  random: () => number = Math.random,
  recentImageIds: readonly string[] = [],
): WanderStep | null {
  const seen = new Set(visited.map((step) => step.postId));
  const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
  const projects = new Map(catalogue.projects.map((project) => [project.id, project]));
  const projectTitles = new Map(catalogue.projects.map((project) => [project.id, project.title]));
  const imageOwners = new Map<string, { post: WanderPost; image: WanderImage }>();
  for (const post of catalogue.posts) {
    for (const image of post.images) imageOwners.set(image.id, { post, image });
  }

  const references: WanderReference[] = [];
  const referencedImages = new Set<string>();
  for (const step of [...visited].reverse()) {
    const post = posts.get(step.postId);
    const image = post?.images.find((item) => item.id === step.imageId) ?? post?.images[0];
    if (!post || !image || referencedImages.has(image.id)) continue;
    references.push({ post, image, projectId: step.projectId });
    referencedImages.add(image.id);
  }
  for (const imageId of recentImageIds) {
    const owner = imageOwners.get(imageId);
    if (!owner || referencedImages.has(imageId)) continue;
    references.push(owner);
    referencedImages.add(imageId);
  }

  const currentPost = posts.get(current?.postId ?? "");
  const currentImage = currentPost?.images.find((item) => item.id === current?.imageId) ?? currentPost?.images[0];
  const recentPostIds = new Set(references.slice(0, WANDER_RECENT_IMAGES_LIMIT).map((item) => item.post.id));
  type PostOption = { post: WanderPost; image: WanderImage; score: number };
  type SourceOption = { id: string; projectId?: string; posts: PostOption[]; score: number };

  const postOption = (post: WanderPost): PostOption | null => {
    const image = pickWanderImage(post.images, recentImageIds, random, currentImage ?? references[0]?.image);
    return image ? { post, image, score: contrastScore(post, image, references, projectTitles) } : null;
  };
  let options: SourceOption[] = catalogue.projects.flatMap((project) => {
    const candidates = project.postIds
      .map((id) => posts.get(id))
      .filter((post): post is WanderPost => Boolean(post && !seen.has(post.id) && post.images.length));
    if (!candidates.length) return [];
    const freshPosts = candidates.filter((post) => !recentPostIds.has(post.id));
    const postPool = freshPosts.length ? freshPosts : candidates;
    const postOptions = postPool.map(postOption).filter((item): item is PostOption => Boolean(item));
    if (!postOptions.length) return [];
    const visualBest = Math.max(...postOptions.map((item) => item.score));
    const recentProjectPenalty = references.slice(0, 6).reduce((penalty, reference, index) =>
      penalty + (reference.post.projectIds.includes(project.id) ? 9 / (index + 1) : 0), 0);
    const currentProjectBonus = project.id !== current?.projectId ? 5 : -12;
    return [{ id: `project:${project.id}`, projectId: project.id, posts: postOptions, score: visualBest + currentProjectBonus - recentProjectPenalty }];
  });

  const publicProjectIds = new Set(projects.keys());
  const standaloneOptions = catalogue.posts.flatMap((post): SourceOption[] => {
    if (seen.has(post.id) || !post.images.length || post.projectIds.some((id) => publicProjectIds.has(id))) return [];
    const option = postOption(post);
    if (!option) return [];
    const recentPenalty = recentPostIds.has(post.id) ? 18 : 0;
    return [{ id: `post:${post.id}`, posts: [option], score: option.score + 5 - recentPenalty }];
  });
  options = [...options, ...standaloneOptions];
  if (!options.length) return null;

  // Never remain in the same collection when another collection still has work.
  const otherSources = options.filter((option) => option.projectId !== current?.projectId);
  if (current?.projectId && otherSources.length) options = otherSources;

  // Shape is the most immediately visible difference. Keep it a hard boundary
  // while at least one opposite-format candidate remains, then add chance.
  if (currentImage) {
    const oppositeFormat = options.flatMap((option): SourceOption[] => {
      const posts = option.posts.filter((item) => orientationContrast(item.image, currentImage) > 0);
      if (!posts.length) return [];
      const previousVisualBest = Math.max(...option.posts.map((item) => item.score));
      const oppositeVisualBest = Math.max(...posts.map((item) => item.score));
      return [{ ...option, posts, score: option.score - previousVisualBest + oppositeVisualBest }];
    });
    if (oppositeFormat.length) options = oppositeFormat;
  }

  // One collection never gets more lottery tickets merely because it is larger;
  // every standalone post is its own source rather than part of a fake common bucket.
  const source = sampleTop(options, (item) => item.score, WANDER_PROJECT_CHAOS_BAND, random) ?? options[0]!;
  const selected = sampleTop(source.posts, (item) => item.score, WANDER_POST_CHAOS_BAND, random) ?? source.posts[0]!;
  return {
    postId: selected.post.id,
    ...(source.projectId ? { projectId: source.projectId } : {}),
    imageId: selected.image.id,
  };
}

/** Saved IDs are revalidated against today's public catalogue, never trusted as content. */
export function restoreWanderJourney(raw: string | null, catalogue: WanderCatalogue): WanderJourney | null {
  if (!raw || raw.length > 200_000) return null;
  try {
    const saved = JSON.parse(raw);
    if (![1, 2, 3, 4].includes(saved?.version) || !Array.isArray(saved.steps)) return null;
    const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
    const projects = new Map(catalogue.projects.map((project) => [project.id, project]));
    const seen = new Set<string>();
    const steps: WanderStep[] = [];
    const selected = saved.steps[saved.cursor]?.postId;
    for (const step of saved.steps) {
      if (!step || typeof step.postId !== "string") continue;
      const post = posts.get(step.postId);
      if (!post || seen.has(post.id)) continue;
      const savedProjectId = typeof step.projectId === "string" ? step.projectId : undefined;
      const projectId = savedProjectId && post.projectIds.includes(savedProjectId) && projects.get(savedProjectId)?.postIds.includes(post.id)
        ? savedProjectId
        : post.projectIds.find((id) => projects.get(id)?.postIds.includes(post.id));
      const imageId = typeof step.imageId === "string" && post.images.some((image) => image.id === step.imageId)
        ? step.imageId : post.images[0]?.id;
      if (!imageId) continue;
      seen.add(post.id);
      steps.push({
        postId: post.id,
        ...(projectId ? { projectId } : {}),
        imageId,
        ...(isWanderNextLabel(step.nextLabel) ? { nextLabel: step.nextLabel } : {}),
      });
    }
    if (!steps.length) return null;
    const index = steps.findIndex((step) => step.postId === selected);
    const savedViewed = saved.version === 1
      ? steps.map((step) => step.postId)
      : Array.isArray(saved.viewedPostIds) ? saved.viewedPostIds : [];
    const validPostIds = new Set(steps.map((step) => step.postId));
    const viewedPostIds: string[] = [];
    for (const id of savedViewed as unknown[]) {
      if (
        typeof id === "string" &&
        validPostIds.has(id) &&
        !viewedPostIds.includes(id)
      ) viewedPostIds.push(id);
    }
    const exhibitionSeenAt = Number.isInteger(saved.exhibitionSeenAt) && saved.exhibitionSeenAt >= 0
      ? Math.min(saved.exhibitionSeenAt, viewedPostIds.length)
      : 0;
    return {
      steps,
      viewedPostIds,
      exhibitionSeenAt,
      cursor: index < 0 ? steps.length - 1 : index,
    };
  } catch {
    return null;
  }
}

export function serializeWanderJourney(journey: WanderJourney): string {
  return JSON.stringify({ version: 4, ...journey });
}

/** Небуквальное название: достаточно странное, но не притворяется AI-куратором. */
export function wanderExhibitionTitle(
  journey: WanderJourney,
  catalogue: WanderCatalogue,
): string {
  const unique = wanderExhibitionTags(journey, catalogue);
  if (!unique.length) return "Без названия";
  if (unique.length === 1) return `«${unique[0]}» вне дома`;
  return `«${unique[0]}» и «${unique.at(-1)}» вышли погулять`;
}

/** The motifs remain supporting material, never the exhibition title itself. */
export function wanderExhibitionTags(
  journey: WanderJourney,
  catalogue: WanderCatalogue,
): string[] {
  const projects = new Map(catalogue.projects.map((project) => [project.id, project.title]));
  const viewed = new Set(journey.viewedPostIds);
  const titles = journey.steps
    .filter((step) => viewed.has(step.postId))
    .map((step) => step.projectId ? projects.get(step.projectId) : undefined)
    .filter((title): title is string => Boolean(title));
  return [...new Set(titles)];
}

/** A stable, session-specific catalogue number that adds collectability without a backend. */
export function wanderExhibitionNumber(journey: WanderJourney): string {
  let hash = 2_166_136_261;
  for (const id of journey.viewedPostIds) {
    for (const character of id) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return String((hash >>> 0) % 100_000).padStart(5, "0");
}
