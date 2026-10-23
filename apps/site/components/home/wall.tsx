import { Collapsible } from "@rind-ui/react"
import roadmap from "@/content/generated/roadmap.json"
import { Letters } from "../letters"
import { MorphLink } from "../morph-link"
import styles from "./home.module.css"
import { Reveal } from "./reveal"
import { WallSpecimens } from "./wall-specimens"

type Item = { category: string; name: string; wave: string; status: string; slug?: string }

const LABEL: Record<string, string> = {
  done: "ready",
  wip: "building",
  spec: "specified",
  research: "researching",
  todo: "planned",
}

/** Every planned component, from the repo's roadmap: the ready ones link to their page. */
export function Wall() {
  const items = roadmap as Item[]
  const ready = items.filter((i) => i.status === "done").length
  const categories = [...new Set(items.map((i) => i.category))]
  return (
    <div className={styles.band} data-band="paper">
      <section className={styles.section} aria-labelledby="wall-title">
        <Reveal>
          <h2 id="wall-title" className={styles.h2}>
            <Letters>{`${ready} ready. ${items.length - ready} on the way.`}</Letters>
          </h2>
          <p className={styles.lead}>
            Every component you would reach for, plus the AI-UI primitives nobody ships yet. Each
            lands complete: spec, tests, driver and docs.
          </p>
        </Reveal>
        <WallSpecimens />
        {/* the whole roadmap, one click away: the count is in the heading, the list on demand */}
        <Collapsible.Root className={styles.wallAll}>
          <Collapsible.Trigger>
            <Collapsible.Indicator>▸</Collapsible.Indicator>
            All {items.length} components, by category
          </Collapsible.Trigger>
          <Collapsible.Content>
            <div className={styles.wall}>
              {categories.map((c) => (
                <Reveal key={c} className={styles.wallGroup}>
                  <h3>{c}</h3>
                  <ul>
                    {items
                      .filter((i) => i.category === c)
                      .map((i) => (
                        <li key={i.name} data-status={i.status}>
                          {i.slug ? (
                            <MorphLink href={`/docs/${i.slug}/`}>{i.name}</MorphLink>
                          ) : (
                            <span>{i.name}</span>
                          )}
                          <small>{LABEL[i.status] ?? i.status}</small>
                        </li>
                      ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </section>
    </div>
  )
}
