"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  nextWanderStep, restoreWanderJourney, serializeWanderJourney,
  wanderExhibitionTitle, WANDER_STORAGE_KEY,
  type WanderCatalogue, type WanderJourney, type WanderPost, type WanderStep,
} from "@/lib/wander";
import styles from "./wander.module.css";

function artworkFrameStyle(post: WanderPost): CSSProperties {
  const ratio = post.image.width && post.image.height
    ? post.image.width / post.image.height
    : 0.8;
  const tidy = (value: number) => Number(value.toFixed(3));
  const frameWidth = `calc(clamp(${tidy(280 * ratio)}px, calc(${tidy(100 * ratio)}svh - ${tidy(245 * ratio)}px), ${tidy(820 * ratio)}px) + (2 * var(--mat)))`;
  return { "--frame-width": frameWidth } as CSSProperties;
}

function Artwork({
  post,
  small = false,
  onLoad,
  onError,
}: {
  post: WanderPost;
  small?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className={styles.imageFallback}>
      <span>{post.title}</span>
      <span className={styles.quiet}>изображение не загрузилось</span>
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- already resized media; supports the site's arbitrary media origins
    <img
      src={small ? post.image.thumbnail : post.image.src}
      alt={post.image.alt}
      width={post.image.width ?? undefined}
      height={post.image.height ?? undefined}
      loading={small ? "lazy" : "eager"}
      decoding="async"
      className={styles.image}
      onLoad={onLoad}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

export function WanderExperience({ catalogue, initialStep, displayName }: {
  catalogue: WanderCatalogue;
  initialStep: WanderStep | null;
  displayName: string;
}) {
  const [journey, setJourney] = useState<WanderJourney>({
    steps: initialStep ? [initialStep] : [],
    viewedPostIds: [],
    cursor: 0,
    exhibitionSeenAt: 0,
  });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"work" | "trail">("work");
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<{
    postId: string;
    status: "loading" | "loaded" | "failed";
  }>({ postId: "", status: "loading" });
  const heading = useRef<HTMLHeadingElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
  const projects = new Map(catalogue.projects.map((project) => [project.id, project]));
  const step = journey.steps[journey.cursor];
  const post = posts.get(step?.postId ?? "");
  const project = projects.get(step?.projectId ?? "");
  const exhausted = journey.steps.length >= catalogue.posts.length;
  const viewed = new Set(journey.viewedPostIds);
  const viewedSteps = journey.steps
    .map((item, journeyIndex) => ({ item, journeyIndex }))
    .filter(({ item }) => viewed.has(item.postId));
  const viewedCount = viewedSteps.length;
  const currentViewed = Boolean(post && viewed.has(post.id));
  const currentImageStatus = imageState.postId === post?.id
    ? imageState.status
    : "loading";
  const exhibitionMilestone = Math.floor(viewedCount / 7) * 7;
  const hasNewExhibition = exhibitionMilestone >= 7 &&
    journey.exhibitionSeenAt < exhibitionMilestone;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = restoreWanderJourney(sessionStorage.getItem(WANDER_STORAGE_KEY), catalogue);
        if (saved) setJourney(saved);
      } catch { /* Storage is optional (private mode / blocked cookies). */ }
      setReady(true);
    });
    return () => { active = false; };
  }, [catalogue]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(WANDER_STORAGE_KEY, serializeWanderJourney(journey)); } catch { /* optional */ }
  }, [journey, ready]);

  function showTrail(markExhibition = false) {
    if (markExhibition) {
      setJourney((previous) => ({
        ...previous,
        exhibitionSeenAt: Math.max(previous.exhibitionSeenAt, exhibitionMilestone),
      }));
    }
    setView("trail");
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    });
  }

  function showWork(cursor = journey.cursor) {
    setJourney((previous) => ({ ...previous, cursor }));
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function advance() {
    const next = nextWanderStep(catalogue, journey.steps, step);
    if (!next) { showTrail(); return; }
    setJourney({
      ...journey,
      steps: [...journey.steps, next],
      cursor: journey.steps.length,
    });
    setImageAttempt(0);
  }

  function restart() {
    const first = nextWanderStep(catalogue, [], undefined);
    setJourney({
      steps: first ? [first] : [],
      viewedPostIds: [],
      cursor: 0,
      exhibitionSeenAt: 0,
    });
    setImageAttempt(0);
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function continueFromTrail() {
    advance();
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function confirmCurrentImage() {
    if (!post) return;
    setImageState({ postId: post.id, status: "loaded" });
    setJourney((previous) => previous.viewedPostIds.includes(post.id)
      ? previous
      : { ...previous, viewedPostIds: [...previous.viewedPostIds, post.id] });
  }

  function failCurrentImage() {
    if (post) setImageState({ postId: post.id, status: "failed" });
  }

  function retryCurrentImage() {
    if (!post) return;
    setImageState({ postId: post.id, status: "loading" });
    setImageAttempt((attempt) => attempt + 1);
  }

  const currentOrdinal = post
    ? Math.max(1, journey.viewedPostIds.indexOf(post.id) + 1 || viewedCount + 1)
    : 0;
  const primaryLabel = currentImageStatus === "failed"
    ? "пропустить"
    : hasNewExhibition
      ? "собрать выставку"
      : exhausted
        ? "посмотреть маршрут"
        : "дальше";
  const primaryDisabled = !ready ||
    (!currentViewed && currentImageStatus === "loading");

  function primaryAction() {
    if (currentImageStatus === "failed") { advance(); return; }
    if (hasNewExhibition) { showTrail(true); return; }
    if (exhausted) { showTrail(); return; }
    advance();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>{displayName}</Link>
        <Link href="/" className={styles.textLink}>выйти к ленте <span aria-hidden>↗</span></Link>
      </header>
      {!post || !project ? (
        <main className={styles.empty}>
          <h1>здесь скоро начнётся прогулка</h1>
          <p>А пока можно посмотреть работы в ленте.</p>
          <Link href="/" className={styles.primary}>к работам →</Link>
        </main>
      ) : view === "trail" ? (
        <main className={styles.trail}>
          <div className={styles.trailHeading}>
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {viewedCount >= 7
                  ? wanderExhibitionTitle(journey, catalogue)
                  : viewedCount ? "вот где вы были" : "пока ничего не увидели"}
              </h1>
              <p className={styles.quiet}>{viewedCount >= 7 ? "кажется, у вас получилась выставка" : "у каждой прогулки своё начало"}</p>
            </div>
            <button type="button" className={styles.textLink} onClick={() => showWork()}>к работе ↗</button>
          </div>
          <ol className={styles.trailGrid}>
            {viewedSteps.map(({ item, journeyIndex }, index) => {
              const work = posts.get(item.postId)!;
              const collection = projects.get(item.projectId)!;
              return (
                <li key={item.postId}>
                  <button type="button" className={styles.trailItem} onClick={() => showWork(journeyIndex)} aria-label={`Вернуться к работе ${index + 1}: ${work.title}`}>
                    <span className={styles.thumbnail}><Artwork post={work} small /></span>
                    <span className={styles.trailCaption}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>{collection.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={styles.trailFooter}>
            <button type="button" className={styles.primary} onClick={exhausted ? restart : continueFromTrail}>
              {exhausted ? "новая прогулка" : "продолжить прогулку"} <span aria-hidden>→</span>
            </button>
            <p className={styles.quiet}>маршрут остаётся в этой вкладке</p>
          </div>
        </main>
      ) : (
        <main className={styles.stage}>
          <h1 className="sr-only">Прогулка по работам</h1>
          <figure className={styles.artwork}>
            <Link
              href={`/p/${post.slug}`}
              prefetch={false}
              className={styles.artLink}
              style={artworkFrameStyle(post)}
              aria-label={`Открыть публикацию: ${post.title}`}
            >
              {ready ? (
                <Artwork
                  key={`${post.id}-${imageAttempt}`}
                  post={post}
                  onLoad={confirmCurrentImage}
                  onError={failCurrentImage}
                />
              ) : <span className={styles.quiet}>сейчас найдётся что-нибудь</span>}
            </Link>
            <figcaption key={`${post.id}-caption`} className={styles.caption}>
              {ready && currentImageStatus === "failed" ? (
                <button type="button" className={styles.textLink} onClick={retryCurrentImage}>попробовать ещё раз ↻</button>
              ) : ready ? <Link href={`/projects/${project.slug}`} prefetch={false}>{project.title}</Link> : "\u00a0"}
            </figcaption>
          </figure>
          <nav className={styles.actions} aria-label="Продолжить прогулку">
            <Link href={`/projects/${project.slug}`} prefetch={false} className={styles.textLink}>вся подборка <span aria-hidden>↗</span></Link>
            <button ref={primaryButton} type="button" disabled={primaryDisabled} onClick={primaryAction} className={styles.primary}>
              {primaryLabel} <span aria-hidden>→</span>
            </button>
          </nav>
          <p role="status" className="sr-only">{ready ? `Работа ${currentOrdinal}: ${post.title} Подборка: ${project.title}.` : "Загружается прогулка"}</p>
          <noscript><p className={styles.quiet}>Для прогулки нужен JavaScript. Подборку можно открыть по ссылке выше.</p></noscript>
        </main>
      )}
    </div>
  );
}
