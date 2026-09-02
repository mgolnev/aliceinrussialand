"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  nextWanderStep,
  rememberWanderImage,
  restoreWanderJourney,
  restoreWanderRecentImages,
  serializeWanderJourney,
  wanderExhibitionNumber,
  wanderExhibitionTags,
  WANDER_RECENT_IMAGES_KEY,
  WANDER_STORAGE_KEY,
  type WanderCatalogue,
  type WanderImage,
  type WanderJourney,
  type WanderPost,
  type WanderStep,
} from "@/lib/wander";
import styles from "./wander.module.css";

function artworkFrameStyle(image: WanderImage): CSSProperties {
  const ratio = image.width && image.height
    ? image.width / image.height
    : 0.8;
  const tidy = (value: number) => Number(value.toFixed(3));
  const frameWidth = `calc(clamp(${tidy(240 * ratio)}px, calc(${tidy(100 * ratio)}svh - ${tidy(330 * ratio)}px), ${tidy(650 * ratio)}px) + (2 * var(--mat)))`;
  return { "--frame-width": frameWidth } as CSSProperties;
}

function worksLabel(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14
    ? "работ"
    : modulo10 === 1 ? "работа" : modulo10 >= 2 && modulo10 <= 4 ? "работы" : "работ";
  return `${count} ${noun}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function artworkRatioStyle(image: WanderImage): CSSProperties {
  return {
    aspectRatio: image.width && image.height
      ? `${image.width} / ${image.height}`
      : "4 / 5",
  };
}

function ArtworkSkeleton({ image }: { image: WanderImage }) {
  return (
    <span className={styles.imageStage} style={artworkRatioStyle(image)}>
      <span className={styles.skeleton} data-testid="wander-skeleton" aria-hidden />
    </span>
  );
}

function Artwork({ post, image, small = false, onLoad, onError }: {
  post: WanderPost;
  image: WanderImage;
  small?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={styles.imageStage} style={artworkRatioStyle(image)}>
      {failed ? (
        <span className={styles.imageFallback}>
          <span>{post.title}</span>
          <span className={styles.quiet}>изображение не загрузилось</span>
        </span>
      ) : (
        <>
          {!loaded ? <span className={styles.skeleton} data-testid="wander-skeleton" aria-hidden /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- already resized media; supports the site's arbitrary media origins */}
          <img
            src={small ? image.thumbnail : image.src}
            alt={image.alt}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading={small ? "lazy" : "eager"}
            decoding="async"
            className={`${styles.image} ${loaded ? styles.imageLoaded : ""}`}
            onLoad={() => {
              setLoaded(true);
              onLoad?.();
            }}
            onError={() => {
              setFailed(true);
              onError?.();
            }}
          />
        </>
      )}
    </span>
  );
}

export function WanderExperience({ catalogue, initialStep }: {
  catalogue: WanderCatalogue;
  initialStep: WanderStep | null;
}) {
  const [journey, setJourney] = useState<WanderJourney>({
    steps: initialStep ? [initialStep] : [],
    viewedPostIds: [],
    cursor: 0,
    exhibitionSeenAt: 0,
  });
  const [ready, setReady] = useState(false);
  const [recentImageIds, setRecentImageIds] = useState<string[]>([]);
  const [view, setView] = useState<"work" | "pause" | "trail">("work");
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<{
    imageId: string;
    status: "loading" | "loaded" | "failed";
  }>({ imageId: "", status: "loading" });
  const heading = useRef<HTMLHeadingElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const finaleTimer = useRef<number | null>(null);
  const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
  const step = journey.steps[journey.cursor];
  const post = posts.get(step?.postId ?? "");
  const image = post?.images.find((item) => item.id === step?.imageId) ?? post?.images[0];
  const exhausted = journey.steps.length >= catalogue.posts.length;
  const viewed = new Set(journey.viewedPostIds);
  const viewedSteps = journey.steps
    .map((item, journeyIndex) => ({ item, journeyIndex }))
    .filter(({ item }) => viewed.has(item.postId));
  const viewedCount = viewedSteps.length;
  const currentViewed = Boolean(post && viewed.has(post.id));
  const currentImageStatus = imageState.imageId === image?.id ? imageState.status : "loading";
  const exhibitionMilestone = Math.floor(viewedCount / 7) * 7;
  const isExhibition = viewedCount >= 7 || (exhausted && viewedCount >= 3);
  const hasNewExhibition = exhibitionMilestone >= 7 && journey.exhibitionSeenAt < exhibitionMilestone;
  const exhibitionTags = wanderExhibitionTags(journey, catalogue);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = restoreWanderJourney(sessionStorage.getItem(WANDER_STORAGE_KEY), catalogue);
        if (saved) setJourney(saved);
        setRecentImageIds(restoreWanderRecentImages(localStorage.getItem(WANDER_RECENT_IMAGES_KEY), catalogue));
      } catch { /* Storage is optional (private mode / blocked cookies). */ }
      setReady(true);
    });
    return () => { active = false; };
  }, [catalogue]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(WANDER_STORAGE_KEY, serializeWanderJourney(journey)); } catch { /* optional */ }
  }, [journey, ready]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(WANDER_RECENT_IMAGES_KEY, JSON.stringify(recentImageIds)); } catch { /* optional */ }
  }, [ready, recentImageIds]);

  useEffect(() => () => {
    if (finaleTimer.current !== null) window.clearTimeout(finaleTimer.current);
  }, []);

  function focusTrail() {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    });
  }

  function showTrail(markExhibition = false) {
    if (markExhibition) {
      setJourney((previous) => ({
        ...previous,
        exhibitionSeenAt: Math.max(previous.exhibitionSeenAt, exhibitionMilestone),
      }));
    }
    setView("trail");
    focusTrail();
  }

  function revealExhibition() {
    setJourney((previous) => ({
      ...previous,
      exhibitionSeenAt: Math.max(previous.exhibitionSeenAt, exhibitionMilestone),
    }));
    if (prefersReducedMotion()) {
      setView("trail");
      focusTrail();
      return;
    }
    setView("pause");
    finaleTimer.current = window.setTimeout(() => {
      setView("trail");
      focusTrail();
    }, 680);
  }

  function showWork(cursor = journey.cursor) {
    setJourney((previous) => ({ ...previous, cursor }));
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function appendStep(next: WanderStep) {
    setJourney((previous) => ({
      ...previous,
      steps: [...previous.steps, next],
      cursor: previous.steps.length,
    }));
    setImageAttempt(0);
    setImageState({ imageId: "", status: "loading" });
  }

  function advance() {
    const next = nextWanderStep(catalogue, journey.steps, step, Math.random, recentImageIds);
    if (!next) { showTrail(); return; }
    appendStep(next);
  }

  function restart() {
    const first = nextWanderStep(catalogue, [], undefined, Math.random, recentImageIds);
    setJourney({
      steps: first ? [first] : [],
      viewedPostIds: [],
      cursor: 0,
      exhibitionSeenAt: 0,
    });
    setImageAttempt(0);
    setImageState({ imageId: "", status: "loading" });
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function continueFromTrail() {
    advance();
    setView("work");
    requestAnimationFrame(() => primaryButton.current?.focus({ preventScroll: true }));
  }

  function confirmCurrentImage() {
    if (!post || !image) return;
    setImageState({ imageId: image.id, status: "loaded" });
    setRecentImageIds((previous) => rememberWanderImage(previous, image.id));
    setJourney((previous) => previous.viewedPostIds.includes(post.id)
      ? previous
      : { ...previous, viewedPostIds: [...previous.viewedPostIds, post.id] });
  }

  function failCurrentImage() {
    if (image) setImageState({ imageId: image.id, status: "failed" });
  }

  function retryCurrentImage() {
    if (!image) return;
    setImageState({ imageId: image.id, status: "loading" });
    setImageAttempt((attempt) => attempt + 1);
  }

  function leaveMode() {
    try { sessionStorage.removeItem(WANDER_STORAGE_KEY); } catch { /* Storage is optional. */ }
  }

  const currentOrdinal = post
    ? Math.max(1, journey.viewedPostIds.indexOf(post.id) + 1 || viewedCount + 1)
    : 0;
  const primaryLabel = currentImageStatus === "failed"
    ? "пропустить"
    : hasNewExhibition || exhausted ? "хватит" : "дальше";
  const primaryDisabled = !ready || (!currentViewed && currentImageStatus === "loading");

  function primaryAction() {
    if (currentImageStatus === "failed") { advance(); return; }
    if (hasNewExhibition) { revealExhibition(); return; }
    if (exhausted) { showTrail(); return; }
    advance();
  }

  return (
    <div className={styles.shell}>
      <Link href="/" className={styles.modeExit} aria-label="выйти" onClick={leaveMode}>×</Link>
      {!post || !image ? (
        <main className={styles.empty}>
          <h1>здесь пока пусто</h1>
          <button type="button" className={styles.textLink} onClick={restart}>попробовать ещё раз</button>
        </main>
      ) : view === "pause" ? (
        <main className={styles.ritual} aria-live="polite">
          <p className={styles.ritualWord}>хватит</p>
        </main>
      ) : view === "trail" ? (
        <main className={`${styles.trail} ${isExhibition ? styles.exhibition : ""}`}>
          <div className={styles.trailHeading}>
            <div className={styles.trailTitle}>
              {isExhibition ? (
                <h1 ref={heading} tabIndex={-1} className={styles.exhibitionNote}>
                  кажется,<br />у вас получилась выставка
                </h1>
              ) : (
                <>
                  <p className={styles.exhibitionNote}>вот где вы были</p>
                  <h1 ref={heading} tabIndex={-1} className={styles.trailName}>
                    {viewedCount ? "странный маршрут" : "пока ничего не увидели"}
                  </h1>
                </>
              )}
            </div>
            <div className={styles.trailControls}>
              <span className={styles.trailCount}>
                {isExhibition
                  ? `выставка №${wanderExhibitionNumber(journey)} · ${worksLabel(viewedCount)}`
                  : worksLabel(viewedCount)}
              </span>
              <button type="button" className={styles.textLink} onClick={() => showWork()}>вернуться к работе</button>
            </div>
          </div>
          <ol className={styles.trailGrid}>
            {viewedSteps.map(({ item, journeyIndex }, index) => {
              const work = posts.get(item.postId)!;
              const workImage = work.images.find((candidate) => candidate.id === item.imageId) ?? work.images[0]!;
              return (
                <li key={`${item.postId}-${workImage.id}`} style={{ "--trail-index": index } as CSSProperties}>
                  <button type="button" className={styles.trailItem} onClick={() => showWork(journeyIndex)} aria-label={`Вернуться к работе ${index + 1}: ${work.title}`}>
                    <span className={styles.thumbnail}><Artwork post={work} image={workImage} small /></span>
                    <span className={styles.trailCaption}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
          {isExhibition && exhibitionTags.length ? <p className={styles.exhibitionTags}>{exhibitionTags.join(" · ")}</p> : null}
          <div className={styles.trailFooter}>
            <button type="button" className={styles.primary} onClick={isExhibition || exhausted ? restart : continueFromTrail}>
              {isExhibition || exhausted ? "пройти ещё раз" : "продолжить прогулку"}
            </button>
          </div>
        </main>
      ) : (
        <main className={styles.stage}>
          <h1 className="sr-only">Прогулка по работам</h1>
          <figure className={styles.artwork}>
            <div data-testid="wander-artwork" className={styles.artFrame} style={artworkFrameStyle(image)}>
              {ready ? (
                <Artwork
                  key={`${post.id}-${image.id}-${imageAttempt}`}
                  post={post}
                  image={image}
                  onLoad={confirmCurrentImage}
                  onError={failCurrentImage}
                />
              ) : <ArtworkSkeleton image={image} />}
            </div>
            <figcaption key={`${post.id}-caption`} className={styles.caption}>
              {ready && currentImageStatus === "failed" ? (
                <button type="button" className={styles.textLink} onClick={retryCurrentImage}>попробовать ещё раз ↻</button>
              ) : "\u00a0"}
            </figcaption>
          </figure>
          <nav className={styles.actions} aria-label="Продолжить прогулку">
            <button ref={primaryButton} type="button" disabled={primaryDisabled} onClick={primaryAction} className={styles.primary}>
              <span className={styles.primaryLabel}>{primaryLabel}</span>
              {primaryLabel === "дальше" ? <span className={styles.primaryArrow} aria-hidden>→</span> : null}
            </button>
          </nav>
          <p role="status" className="sr-only">{ready ? `Работа ${currentOrdinal}: ${post.title}.` : "Начинается прогулка"}</p>
          <noscript><p className={styles.quiet}>Для прогулки нужен JavaScript.</p></noscript>
        </main>
      )}
    </div>
  );
}
