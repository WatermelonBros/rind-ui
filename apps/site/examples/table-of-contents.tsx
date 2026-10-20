"use client"

import type { TableOfContentsItem } from "@rind-ui/core"
import { TableOfContents } from "@rind-ui/react"
import { useRef } from "react"
import type { States, Variants } from "./types"

/** `navigating` lasts while a followed link's jump scrolls: reached by clicking a link. */
export const states: States = { "table-of-contents": { tracking: "Article" } }

/** Inline layout: theme pages do not load the site's helper classes. */
const LAYOUT = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 11rem",
  gap: 24,
  inlineSize: "min(100%, 640px)",
  alignItems: "start",
} as const
const SCROLLER = { blockSize: 320, overflow: "auto", paddingInlineEnd: 8 } as const

const SECTIONS: readonly (TableOfContentsItem & { readonly text: string })[] = [
  {
    id: "toc-overview",
    label: "Overview",
    depth: 0,
    text: "A headless component gives you behaviour, accessibility and state; you bring the styles through data attributes.",
  },
  {
    id: "toc-install",
    label: "Installation",
    depth: 0,
    text: "Add the React package and, if you want a starting point, the theme. Both are tree-shaken: you pay for what you import.",
  },
  {
    id: "toc-npm",
    label: "With npm",
    depth: 1,
    text: "Run the install command in your project. The packages have no runtime dependency beyond React.",
  },
  {
    id: "toc-theme",
    label: "The theme",
    depth: 1,
    text: "Import the stylesheet once. Every rule sits in a cascade layer, so your own styles win without specificity fights.",
  },
  {
    id: "toc-usage",
    label: "Usage",
    depth: 0,
    text: "Compose the parts you need. Each part forwards the props of the element it renders, and can render another element instead.",
  },
  {
    id: "toc-testing",
    label: "Testing",
    depth: 0,
    text: "Each component ships a driver: the same actions your users take, by pointer, keyboard or screen reader.",
  },
  {
    id: "toc-faq",
    label: "FAQ",
    depth: 0,
    text: "Short sections at the end still become current when you reach the bottom.",
  },
]

function Contents({ title = false }: { readonly title?: boolean }) {
  return (
    <>
      {title ? <TableOfContents.Title>Contents</TableOfContents.Title> : null}
      <TableOfContents.List>
        {SECTIONS.map((s) => (
          <TableOfContents.Item key={s.id} item={s}>
            <TableOfContents.Link />
          </TableOfContents.Item>
        ))}
        <TableOfContents.Indicator />
      </TableOfContents.List>
    </>
  )
}

/** `scrollMarginTop`: where a jump lands the heading (below a sticky header). */
function Sections({ tall, margin }: { readonly tall: boolean; readonly margin: number }) {
  const heading = { margin: "0 0 8px", scrollMarginTop: margin }
  return SECTIONS.map((s) => (
    <section key={s.id} style={{ paddingBlockEnd: tall && s.depth === 0 ? 120 : 24 }}>
      {s.depth === 0 ? (
        <h2 id={s.id} style={heading}>
          {s.label}
        </h2>
      ) : (
        <h3 id={s.id} style={heading}>
          {s.label}
        </h3>
      )}
      <p style={{ margin: 0 }}>{s.text}</p>
    </section>
  ))
}

export function Article() {
  const scroller = useRef<HTMLElement | null>(null)
  return (
    <div style={LAYOUT}>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard (axe scrollable-region-focusable) */}
      <section ref={scroller} style={SCROLLER} tabIndex={0} aria-label="Article">
        <Sections tall margin={8} />
      </section>
      <TableOfContents.Root items={SECTIONS} scrollRoot={scroller}>
        <Contents title />
      </TableOfContents.Root>
    </div>
  )
}

export function StickyHeader() {
  const scroller = useRef<HTMLElement | null>(null)
  return (
    <div style={LAYOUT}>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard (axe scrollable-region-focusable) */}
      <section ref={scroller} style={SCROLLER} tabIndex={0} aria-label="Guide">
        <div
          style={{
            position: "sticky",
            top: 0,
            blockSize: 48,
            display: "flex",
            alignItems: "center",
            background: "var(--rind-color-bg, Canvas)",
            borderBlockEnd: "1px solid var(--rind-color-border, GrayText)",
            fontWeight: 600,
          }}
        >
          Guide
        </div>
        <div style={{ paddingBlockStart: 12 }}>
          <Sections tall={false} margin={56} />
        </div>
      </section>
      <TableOfContents.Root items={SECTIONS} scrollRoot={scroller} offset={48}>
        <Contents />
      </TableOfContents.Root>
    </div>
  )
}

export const variants: Variants = {
  Article: {
    title: "Article",
    description:
      "The section being read is current; links jump to their heading, and Enter moves focus there. Scroll to the end: the short last section becomes current.",
  },
  StickyHeader: {
    title: "Sticky header",
    description: "`offset={48}`: the reading line starts below the header that covers the top.",
  },
}
