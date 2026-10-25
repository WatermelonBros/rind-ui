"use client"

// a client component even with no state: rendered from a server page, its arrays of letters
// shifted the ids of the client components after it (useId) between the HTML and hydration
import { type CSSProperties, Fragment } from "react"
import styles from "./letters.module.css"

/**
 * A title whose letters come alive (letters.module.css, played by letters-replay.tsx): they swell
 * one after another and bounce back in juicy, and snap stiff in crisp. The text is read once, whole;
 * the letters are only drawn. Words stay unbroken, so the title wraps where it did.
 */
export function Letters({ children }: { children: string }) {
  let i = 0
  return (
    <>
      <span className={styles.visuallyHidden}>{children}</span>
      {/* letters-replay.tsx writes data-play here as soon as it is seen, which can be before a
          suspended section (the machine) hydrates: that attribute is the DOM's, not a mismatch */}
      <span
        className={styles.title}
        data-letters-title=""
        aria-hidden="true"
        suppressHydrationWarning
      >
        {children.split(" ").map((word, w) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static title's words, never reordered
          <Fragment key={w}>
            {w > 0 && " "}
            <span className={styles.word}>
              {[...word].map((ch) => (
                // a custom property: CSSProperties has no index for them
                <span key={i} className={styles.ch} style={{ "--i": i++ } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  )
}
