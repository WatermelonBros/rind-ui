import styles from "./marquee.module.css"

/** The component names scroll by; the list is doubled so the loop has no seam. */
export function Marquee({ items }: { items: readonly string[] }) {
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        {[...items, ...items].map((name, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the doubled list repeats names
          <span key={`${name}-${i}`}>{name}</span>
        ))}
      </div>
    </div>
  )
}
