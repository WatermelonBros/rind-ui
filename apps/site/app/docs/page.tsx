import type { Metadata } from "next"
import Link from "next/link"
import { pages } from "@/lib/docs"
import styles from "./docs.module.css"

export const metadata: Metadata = { title: "Docs" }

export default function DocsIndex() {
  const section = (id: string, title: string, list: typeof pages) => (
    <>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.cards}>
        {list.map((p) => (
          <Link key={p.slug} href={`/docs/${p.slug}/`} className={styles.card}>
            <strong>{p.title}</strong>
            <span>{p.summary.replace(/[`*[\]]/g, "").replace(/\(([^)]+\.md)\)/g, "")}</span>
          </Link>
        ))}
      </div>
    </>
  )
  return (
    <div>
      <header className={styles.head}>
        <p className={styles.kicker}>Documentation</p>
        <h1 className={styles.title}>Build the look. We did the rest.</h1>
        <p className={styles.summary}>
          Every rind component ships behaviour, accessibility, state and a test driver. You style it
          through <code>data-*</code> attributes.
        </p>
      </header>
      {section(
        "components",
        "Components",
        pages.filter((p) => p.section === "components"),
      )}
      {section(
        "guides",
        "Guides",
        pages.filter((p) => p.section === "guides"),
      )}
    </div>
  )
}
