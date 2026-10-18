import Link from "next/link"
import type { ReactNode } from "react"
import { type NavGroup, Sidebar } from "@/components/sidebar"
import { pages } from "@/lib/docs"
import styles from "./docs.module.css"
// every component's skin (the landing loads only its own: skins/home.css)
import "@/skins/index.css"

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
        <footer className={styles.footer}>
          <span>
            rind · headless components by Watermelon · MIT · <Link href="/privacy/">Privacy</Link>
          </span>
          <a href="https://reado.watermelon-studio.it">
            Built using <b>Reado</b> ↗
          </a>
        </footer>
      </main>
    </div>
  )
}
