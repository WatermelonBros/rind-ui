import type { Metadata } from "next"
import Link from "next/link"
import { Letters } from "@/components/letters"
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
          <Link prefetch={false} key={p.slug} href={`/docs/${p.slug}/`} className={styles.card}>
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
        <h1 className={styles.title}>
          <Letters>Everything but the look.</Letters>
        </h1>
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
