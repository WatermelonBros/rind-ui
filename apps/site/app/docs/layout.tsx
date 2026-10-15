import type { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"
import { pages } from "@/lib/docs"
import styles from "./docs.module.css"

export default function DocsLayout({ children }: { children: ReactNode }) {
  const nav = {
    components: pages
      .filter((p) => p.section === "components")
      .map(({ slug, title }) => ({ slug, title })),
    guides: pages.filter((p) => p.section === "guides").map(({ slug, title }) => ({ slug, title })),
  }
  return (
    <div className={styles.shell}>
      <Sidebar nav={nav} />
      <div className={styles.main}>{children}</div>
    </div>
  )
}
