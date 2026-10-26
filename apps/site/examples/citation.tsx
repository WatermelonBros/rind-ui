"use client"

import type { CitationSource } from "@rind-ui/core"
import { Citation } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = { citation: { idle: "Basic" } }

const sources: Record<number, CitationSource> = {
  1: {
    title: "WAI-ARIA Authoring Practices: Combobox",
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/combobox/",
    snippet: "A combobox is an input widget that has an associated popup.",
  },
  2: { title: "Internal design notes", snippet: "No public link: the card pins open instead." },
}

function Cite({
  index,
  source,
}: {
  readonly index: number
  readonly source?: CitationSource | undefined
}) {
  return (
    <Citation.Root index={index} {...(source ? { source } : {})}>
      <Citation.Trigger />
      <Citation.Portal>
        <Citation.Positioner>
          <Citation.Content>
            <Citation.Source>
              <Citation.SourceTitle />
              <Citation.SourceUrl />
              <Citation.SourceSnippet />
              {source?.url && <Citation.SourceLink>Open source</Citation.SourceLink>}
            </Citation.Source>
          </Citation.Content>
        </Citation.Positioner>
      </Citation.Portal>
    </Citation.Root>
  )
}

export function Basic() {
  return (
    <div className="stack cite-answer">
      <p>
        A combobox keeps focus in its input and points at the highlighted option with
        aria-activedescendant <Cite index={1} source={sources[1]} />. The team settled on
        auto-highlighting the first result while typing <Cite index={2} source={sources[2]} />, and
        a third source is still streaming in <Cite index={3} />.
      </p>
      <ol className="cite-sources" aria-label="Sources">
        <li>
          <a href={sources[1]?.url}>{sources[1]?.title}</a>
        </li>
        <li>{sources[2]?.title}</li>
      </ol>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "In an answer",
    description:
      "Hover or focus a marker for its card. 1 is a link, 2 has no URL so a press pins the card, 3 is still pending.",
  },
}
