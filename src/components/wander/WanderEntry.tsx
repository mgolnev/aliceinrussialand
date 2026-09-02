"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WANDER_STORAGE_KEY } from "@/lib/wander";
import { DEFAULT_WANDER_ENTRY_LABEL } from "@/lib/wander-settings";
import styles from "./WanderEntry.module.css";

export function WanderEntry({ label }: { label?: string }) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const entryLabel = label?.trim() || DEFAULT_WANDER_ENTRY_LABEL;
  const usesAuthorHandwriting = leaving || (
    entryLabel.toLocaleLowerCase("ru-RU") === DEFAULT_WANDER_ENTRY_LABEL
  );

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.removeItem(WANDER_STORAGE_KEY); } catch { /* A new walk still starts when storage is blocked. */ }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => router.push("/wander"), reducedMotion ? 0 : 560);
  }

  return (
    <div className={styles.entry}>
      <button
        type="button"
        onClick={enter}
        disabled={leaving}
        className={`${styles.note} ${leaving ? styles.confirmation : styles.invitation}`}
        data-paper={leaving ? "lined" : "grid"}
        data-author-handwriting={usesAuthorHandwriting ? "true" : "false"}
        aria-live="polite"
      >
        {usesAuthorHandwriting ? (
          <>
            <span
              aria-hidden="true"
              className={`${styles.vectorMark} ${leaving ? styles.confirmVector : styles.entryVector}`}
            />
            <span className="sr-only">{leaving ? "точно?" : entryLabel}</span>
          </>
        ) : (
          <span className={styles.label}>{entryLabel}</span>
        )}
      </button>
    </div>
  );
}
