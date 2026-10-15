import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { pageBySlug, pages, render } from "@/lib/docs"
import styles from "../docs.module.css"

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return pages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageBySlug((await params).slug)
  return page ? { title: page.title, description: page.summary } : {}
}

export default async function DocPage({ params }: Props) {
  const page = pageBySlug((await params).slug)
  if (!page) notFound()
  const { html, toc } = render(page)
  return (
    <div className={styles.page}>
      <article>
        <header className={styles.head}>
          <p className={styles.kicker}>{page.section === "components" ? "Component" : "Guide"}</p>
          <h1 className={styles.title}>{page.title}</h1>
        </header>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: built at compile time from the repo's own docs */}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      {toc.length > 0 && (
        <nav className={styles.toc} aria-label="On this page">
          <p>On this page</p>
          {toc.map((t) => (
            <a key={t.id} href={`#${t.id}`}>
              {t.text}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
