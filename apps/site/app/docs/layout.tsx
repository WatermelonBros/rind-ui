import type { ReactNode } from "react"
import { type NavGroup, Sidebar } from "@/components/sidebar"
import { pages } from "@/lib/docs"
import styles from "./docs.module.css"

/** "hidden-until-found" → "Hidden until found": guide titles are sentences, the nav wants names. */
const shortLabel = (slug: string) => {
  const words = slug.split("-").join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  const groups: NavGroup[] = [
    {
      title: "Start",
      entries: pages
        .filter((p) => p.section === "start")
        .map(({ slug, title }) => ({ slug, label: title })),
    },
    {
      title: "Components",
      entries: pages
        .filter((p) => p.section === "components")
        .map(({ slug, title }) => ({ slug, label: title })),
    },
    {
      title: "Guides",
      entries: pages
        .filter((p) => p.section === "guides")
        .map(({ slug }) => ({ slug, label: shortLabel(slug) })),
    },
  ]
  return (
    <div className={styles.shell} data-surface="docs">
      <Sidebar groups={groups} />
      <main id="content" className={styles.main}>
        {children}
      </main>
    </div>
  )
}
