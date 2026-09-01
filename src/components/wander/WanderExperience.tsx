"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  nextWanderStep,
  nextWanderStepInProject,
  restoreWanderJourney,
  serializeWanderJourney,
  wanderExhibitionNumber,
  wanderExhibitionTags,
  wanderExhibitionTitle,
  WANDER_STORAGE_KEY,
  type WanderCatalogue,
  type WanderJourney,
  type WanderPost,
  type WanderStep,
} from "@/lib/wander";
import styles from "./wander.module.css";

function artworkFrameStyle(post: WanderPost): CSSProperties {
  const ratio = post.image.width && post.image.height
    ? post.image.width / post.image.height
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

function Artwork({ post, small = false, onLoad, onError }: {
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
  const [view, setView] = useState<"work" | "pause" | "trail">("work");
  const [introPhase, setIntroPhase] = useState<"blank" | "word" | "done">("blank");
  const [introRun, setIntroRun] = useState(0);
  const [stayMessage, setStayMessage] = useState<string | null>(null);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<{
    postId: string;
    status: "loading" | "loaded" | "failed";
  }>({ postId: "", status: "loading" });
  const heading = useRef<HTMLHeadingElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const finaleTimer = useRef<number | null>(null);
  const posts = new Map(catalogue.posts.map((post) => [post.id, post]));
  const projects = new Map(catalogue.projects.map((project) => [project.id, project]));
  const step = journey.steps[journey.cursor];
  const post = posts.get(step?.postId ?? "");
  const project = projects.get(step?.projectId ?? "");
  const attempted = new Set(journey.steps.map((item) => item.postId));
  const canStay = Boolean(project?.postIds.some((postId) => posts.has(postId) && !attempted.has(postId)));
  const exhausted = journey.steps.length >= catalogue.posts.length;
  const viewed = new Set(journey.viewedPostIds);
  const viewedSteps = journey.steps
    .map((item, journeyIndex) => ({ item, journeyIndex }))
    .filter(({ item }) => viewed.has(item.postId));
  const viewedCount = viewedSteps.length;
  const currentViewed = Boolean(post && viewed.has(post.id));
  const currentImageStatus = imageState.postId === post?.id ? imageState.status : "loading";
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
    let active = true;
    const timers: number[] = [];
    setIntroPhase("blank");
    if (prefersReducedMotion()) {
      queueMicrotask(() => { if (active) setIntroPhase("done"); });
    } else {
      timers.push(window.setTimeout(() => setIntroPhase("word"), 180));
      timers.push(window.setTimeout(() => setIntroPhase("done"), 760));
    }
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [introRun]);

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
    setStayMessage(null);
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
  }

  function advance() {
    const next = nextWanderStep(catalogue, journey.steps, step);
    setStayMessage(null);
    if (!next) { showTrail(); return; }
    appendStep(next);
  }

  function stayHere() {
    if (!project) return;
    const next = nextWanderStepInProject(catalogue, journey.steps, project.id);
    if (!next) return;
    setStayMessage(`остаёмся в ${project.title}`);
    appendStep(next);
  }

  function restart() {
    const first = nextWanderStep(catalogue, [], undefined);
    setJourney({
      steps: first ? [first] : [],
      viewedPostIds: [],
      cursor: 0,
      exhibitionSeenAt: 0,
    });
    setStayMessage(null);
    setImageAttempt(0);
    setView("work");
    setIntroRun((run) => run + 1);
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
      {!post || !project ? (
        <main className={styles.empty}>
          <h1>здесь пока пусто</h1>
          <button type="button" className={styles.textLink} onClick={restart}>попробовать ещё раз</button>
        </main>
      ) : introPhase !== "done" ? (
        <main className={styles.ritual} aria-live="polite">
          <p className={styles.ritualWord}>{introPhase === "word" ? "это" : "\u00a0"}</p>
        </main>
      ) : view === "pause" ? (
        <main className={styles.ritual} aria-live="polite">
          <p className={styles.ritualWord}>хватит</p>
        </main>
      ) : view === "trail" ? (
        <main className={`${styles.trail} ${isExhibition ? styles.exhibition : ""}`}>
          <div className={styles.trailHeading}>
            <div className={styles.trailTitle}>
              <p className={styles.exhibitionNote}>
                {isExhibition ? <>кажется,<br />у вас получилась выставка</> : "вот где вы были"}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {isExhibition
                  ? wanderExhibitionTitle(journey, catalogue)
                  : viewedCount ? "странный маршрут" : "пока ничего не увидели"}
              </h1>
            </div>
            <div className={styles.trailControls}>
              <span className={styles.trailCount}>
                {isExhibition
                  ? `выставка №${wanderExhibitionNumber(journey)} · ${worksLabel(viewedCount)}`
                  : worksLabel(viewedCount)}
              </span>
              <button type="button" className={styles.textLink} onClick={() => showWork()}>подойти</button>
            </div>
          </div>
          <ol className={styles.trailGrid}>
            {viewedSteps.map(({ item, journeyIndex }, index) => {
              const work = posts.get(item.postId)!;
              return (
                <li key={item.postId} style={{ "--trail-index": index } as CSSProperties}>
                  <button type="button" className={styles.trailItem} onClick={() => showWork(journeyIndex)} aria-label={`Вернуться к работе ${index + 1}: ${work.title}`}>
                    <span className={styles.thumbnail}><Artwork post={work} small /></span>
                    <span className={styles.trailCaption}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
          {isExhibition ? <p className={styles.exhibitionTags}>{exhibitionTags.join(" · ")}</p> : null}
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
            <div data-testid="wander-artwork" className={styles.artFrame} style={artworkFrameStyle(post)}>
              {ready ? (
                <Artwork
                  key={`${post.id}-${imageAttempt}`}
                  post={post}
                  onLoad={confirmCurrentImage}
                  onError={failCurrentImage}
                />
              ) : <span className={styles.quiet}>&nbsp;</span>}
            </div>
            <figcaption key={`${post.id}-caption`} className={styles.caption}>
              {ready && currentImageStatus === "failed" ? (
                <button type="button" className={styles.textLink} onClick={retryCurrentImage}>попробовать ещё раз ↻</button>
              ) : stayMessage ?? "\u00a0"}
            </figcaption>
          </figure>
          <nav className={styles.actions} aria-label="Продолжить прогулку">
            {canStay && currentImageStatus !== "failed" ? (
              <button type="button" disabled={primaryDisabled} onClick={stayHere} className={styles.textLink}>остаться</button>
            ) : <span aria-hidden />}
            <button ref={primaryButton} type="button" disabled={primaryDisabled} onClick={primaryAction} className={styles.primary}>
              {primaryLabel} {primaryLabel === "дальше" ? <span aria-hidden>→</span> : null}
            </button>
          </nav>
          <p role="status" className="sr-only">{ready ? `Работа ${currentOrdinal}: ${post.title}.` : "Начинается прогулка"}</p>
          <noscript><p className={styles.quiet}>Для прогулки нужен JavaScript.</p></noscript>
        </main>
      )}
    </div>
  );
}
