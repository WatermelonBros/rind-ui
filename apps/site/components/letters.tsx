import { type CSSProperties, Fragment } from "react"
import styles from "./letters.module.css"

/**
 * A title whose letters answer the phase (home.module.css: .ch): when it changes they swell one
 * after another and bounce back in juicy, and snap stiff in crisp. The text is read once, whole;
 * the letters are only drawn. Words stay unbroken, so the title wraps where it did.
 */
export function Letters({ children }: { children: string }) {
  let i = 0
  return (
    <>
      <span className={styles.visuallyHidden}>{children}</span>
      <span aria-hidden="true">
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
