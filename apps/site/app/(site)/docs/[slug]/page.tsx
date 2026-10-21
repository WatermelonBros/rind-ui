import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CopyMarkdown } from "@/components/copy-markdown"
import { ExampleFrame } from "@/components/example-frame"
import { ExamplesSection } from "@/components/examples-section"
import { ReleaseSync } from "@/components/release"
import { Toc } from "@/components/toc"
import { exampleCode, pageBySlug, pages, render } from "@/lib/docs"
import styles from "../docs.module.css"

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return pages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageBySlug((await params).slug)
  return page
    ? {
        title: page.title,
        description: page.summary,
        // the same page as plain markdown, for agents (scripts/content.ts)
        alternates: { types: { "text/markdown": `/docs/${page.slug}.md` } },
      }
    : {}
}

export default async function DocPage({ params }: Props) {
  const page = pageBySlug((await params).slug)
  if (!page) notFound()
  const source = exampleCode(page.slug)
  const order = ["start", "components", "guides"].flatMap((s) =>
    pages.filter((p) => p.section === s),
  )
  const at = order.findIndex((p) => p.slug === page.slug)
  const prev = order[at - 1]
  const next = order[at + 1]
  const {
    intro,
    html,
    toc: outline,
  } = render(page, { hasExample: Boolean(source) && page.section === "components" })
  // the Examples section lists every example but the first, so a page with one (a guide) has none
  const toc =
    source && Object.keys(source.code).length > 1
      ? [{ id: "examples", text: "Examples" }, ...outline]
      : outline
  return (
    <div className={styles.page}>
      <article>
        <header className={styles.head}>
          <h1 className={styles.title} data-page-title="">
            {page.title}
          </h1>
          <CopyMarkdown slug={page.slug} />
        </header>
        {source && (
          <ExampleFrame
            slug={page.slug}
            name="Basic"
            source={source}
            label={`${page.title} example`}
            headingLevel={2}
            hero
          />
        )}
        <div
          className={`${styles.prose} ${styles.intro}`}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: built at compile time from the repo's own docs
          dangerouslySetInnerHTML={{ __html: intro }}
        />
        {source && <ExamplesSection slug={page.slug} source={source} />}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: built at compile time from the repo's own docs */}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
        <ReleaseSync />
        <nav className={styles.pager} aria-label="Pages">
          {prev ? (
            <Link href={`/docs/${prev.slug}/`} rel="prev">
              <small>Previous</small>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}/`} rel="next" data-next="">
              <small>Next</small>
              {next.title}
            </Link>
          )}
        </nav>
      </article>
      {toc.length > 0 && <Toc entries={toc} />}
    </div>
  )
}
