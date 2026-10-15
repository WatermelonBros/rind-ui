"use client"

import { examples } from "@/examples"
import { type ExampleCode, ExampleFrame } from "./example-frame"
import styles from "./example-frame.module.css"

/** Inline `code` spans in a variant description. */
const withCode = (text: string) =>
  text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of a fixed string
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  )

/** Every example after the first, Ark-style: a title, one line of why, the live component. */
export function ExamplesSection({ slug, source }: { slug: string; source: ExampleCode }) {
  const mod = examples[slug]
  if (!mod) return null
  const rest = Object.entries(mod.variants).slice(1)
  if (rest.length === 0) return null
  return (
    <section className={styles.examples} aria-labelledby="examples">
      <h2 id="examples">Examples</h2>
      {rest.map(([name, { title, description }]) => (
        <div key={name} className={styles.variant}>
          <h3 id={`example-${name.toLowerCase()}`}>{title}</h3>
          {description && <p>{withCode(description)}</p>}
          <ExampleFrame
            slug={slug}
            name={name}
            source={source}
            label={`${title} example`}
            headingLevel={4}
          />
        </div>
      ))}
    </section>
  )
}
