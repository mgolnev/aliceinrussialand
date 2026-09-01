/** Small, public-only catalogue. No post bodies or admin fields reach the client. */
export type WanderPost = {
  id: string;
  slug: string;
  title: string;
  image: { src: string; thumbnail: string; alt: string; width: number | null; height: number | null };
  projectIds: string[];
};

export type WanderProject = { id: string; slug: string; title: string; postIds: string[] };
export type WanderCatalogue = { posts: WanderPost[]; projects: WanderProject[] };
export type WanderStep = { postId: string; projectId: string };
export type WanderJourney = {
  /** Все предложенные работы: они не повторяются, даже если картинка сломана. */
  steps: WanderStep[];
  /** Только работы, изображение которых действительно загрузилось. */
  viewedPostIds: string[];
  cursor: number;
  /** Последний отмеченный рубеж 7 / 14 / 21… работ. */
  exhibitionSeenAt: number;
};
export const WANDER_STORAGE_KEY = "alice:wander:v1";

function sample<T>(items: T[], random: () => number): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** Cross a shared work into another collection; only jump randomly at a dead end. */
export function nextWanderStep(
  catalogue: WanderCatalogue,
  visited: WanderStep[],
  current?: WanderStep,
  random: () => number = Math.random,
): WanderStep | null {
  const seen = new Set(visited.map((step) => step.postId));
  const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
  const available = catalogue.projects
    .map((project) => ({ ...project, postIds: project.postIds.filter((id) => posts.has(id) && !seen.has(id)) }))
    .filter((project) => project.postIds.length > 0);
  if (!available.length) return null;

  const currentPost = posts.get(current?.postId ?? "");
  const exits = available.filter((project) =>
    project.id !== current?.projectId && currentPost?.projectIds.includes(project.id),
  );
  const same = available.find((project) => project.id === current?.projectId);
  const recentSameCount = current
    ? [...visited].reverse().findIndex((step) => step.projectId !== current.projectId)
    : 0;
  const stayedTwice = recentSameCount === -1
    ? visited.length >= 2
    : recentSameCount >= 2;
  const openingProjectId = visited[0]?.projectId;
  const firstDeparture = openingProjectId
    ? visited.findIndex((step) => step.projectId !== openingProjectId)
    : -1;
  const hasReturnedToOpening = firstDeparture >= 0 &&
    visited.slice(firstDeparture + 1).some((step) => step.projectId === openingProjectId);
  const openingReturn = visited.length >= 4 && !hasReturnedToOpening
    ? available.find((project) =>
        project.id === openingProjectId && project.id !== current?.projectId,
      )
    : undefined;
  const otherProjects = available.filter((project) => project.id !== current?.projectId);

  // Реальная связь сильнее случайности. Без неё — не более двух работ серии
  // подряд, а через несколько шагов по возможности возвращается первый мотив.
  const project = sample(exits, random)
    ?? openingReturn
    ?? (stayedTwice ? sample(otherProjects, random) : same)
    ?? sample(otherProjects, random)
    ?? same
    ?? sample(available, random)!;
  const availableById = new Map(available.map((item) => [item.id, item]));
  const bridges = project.postIds.filter((id) => posts.get(id)?.projectIds.some((projectId) =>
    projectId !== project.id &&
    availableById.get(projectId)?.postIds.some((candidateId) => candidateId !== id),
  ));
  const postId = sample(bridges.length ? bridges : project.postIds, random)!;
  return { postId, projectId: project.id };
}

/** Stay with the current motif without revealing that it is a catalogue filter. */
export function nextWanderStepInProject(
  catalogue: WanderCatalogue,
  visited: WanderStep[],
  projectId: string,
  random: () => number = Math.random,
): WanderStep | null {
  const seen = new Set(visited.map((step) => step.postId));
  const posts = new Set(catalogue.posts.map((post) => post.id));
  const project = catalogue.projects.find((item) => item.id === projectId);
  if (!project) return null;
  const candidates = project.postIds.filter((postId) => posts.has(postId) && !seen.has(postId));
  const postId = sample(candidates, random);
  return postId ? { postId, projectId } : null;
}

/** Saved IDs are revalidated against today's public catalogue, never trusted as content. */
export function restoreWanderJourney(raw: string | null, catalogue: WanderCatalogue): WanderJourney | null {
  if (!raw || raw.length > 200_000) return null;
  try {
    const saved = JSON.parse(raw);
    if ((saved?.version !== 1 && saved?.version !== 2) || !Array.isArray(saved.steps)) return null;
    const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
    const projects = new Map(catalogue.projects.map((project) => [project.id, project]));
    const seen = new Set<string>();
    const steps: WanderStep[] = [];
    const selected = saved.steps[saved.cursor]?.postId;
    for (const step of saved.steps) {
      if (!step || typeof step.postId !== "string" || typeof step.projectId !== "string") continue;
      const post = posts.get(step.postId);
      if (!post || seen.has(post.id)) continue;
      const projectId = post.projectIds.includes(step.projectId)
        ? step.projectId : post.projectIds.find((id) => projects.has(id));
      if (!projectId || !projects.get(projectId)?.postIds.includes(post.id)) continue;
      seen.add(post.id);
      steps.push({ postId: post.id, projectId });
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
  return JSON.stringify({ version: 2, ...journey });
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
    .map((step) => projects.get(step.projectId))
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
