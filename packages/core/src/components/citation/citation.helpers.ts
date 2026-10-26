// Citation helpers (add-citation design §5): pure, no DOM. A URL is used only for allowed
// schemes and parsed in a try (AI Elements calls new URL unguarded); citations split text by
// character ranges (UTF-16 offsets, the AI SDK and OpenAI shape), never by parsing markdown.

/** The URL when its scheme is allowed (http, https by default), else undefined. Never throws. */
export function safeHref(
  url: string | undefined,
  options: { readonly schemes?: readonly string[] } = {},
): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return (options.schemes ?? ["http:", "https:"]).includes(parsed.protocol)
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}

/** The hostname without `www.`, or undefined for an unparsable URL. */
export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

export interface CitationRange {
  readonly start: number
  readonly end: number
  readonly index: number
}

export type CitationSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "cite"; readonly text: string; readonly index: number }

/** Text and citation segments in order; overlapping and out-of-range ranges are dropped. */
export function splitByCitations(
  text: string,
  ranges: readonly CitationRange[],
): CitationSegment[] {
  const sorted = [...ranges]
    .filter((r) => r.start >= 0 && r.end <= text.length && r.start < r.end)
    .sort((a, b) => a.start - b.start)
  const out: CitationSegment[] = []
  let at = 0
  for (const r of sorted) {
    if (r.start < at) continue
    if (r.start > at) out.push({ kind: "text", text: text.slice(at, r.start) })
    out.push({ kind: "cite", text: text.slice(r.start, r.end), index: r.index })
    at = r.end
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) })
  return out
}
