// Heading has no machine (design §1): its level comes from props and the nearest level
// context, and its attributes from the rendered tag.

import { type PartProps, scopeAttrs } from "../../connect/props"

declare const process: { env: { NODE_ENV?: string } }

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** The level outside any `Heading.Level`: the page is assumed to own its `h1`. */
export const ROOT_HEADING_LEVEL = 2

const clamp = (n: number): HeadingLevel => Math.min(6, Math.max(1, Math.round(n))) as HeadingLevel // integer in 1..6 by construction

const warn = (message: string) => {
  if (process.env.NODE_ENV !== "production") console.warn(`[rind-ui] heading: ${message}`)
}

/**
 * A level a consumer gave (`level` prop, `Heading.Level level`): clamped to 1–6, with a
 * development warning naming the value when it was not a valid level.
 */
export function validHeadingLevel(value: number): HeadingLevel {
  const level = Number.isNaN(value) ? ROOT_HEADING_LEVEL : clamp(value)
  if (level !== value) warn(`level ${value} is not an integer from 1 to 6; using ${level}`)
  return level
}

/**
 * The level a `Heading.Level` gives its descendants: its own `level`, or one more than the
 * level around it. Kept unclamped, so a heading deeper than six levels can warn.
 */
export function nextHeadingLevel(parent: number | undefined, level: number | undefined): number {
  return level === undefined ? (parent ?? ROOT_HEADING_LEVEL) + 1 : validHeadingLevel(level)
}

/** Whether a level from the context is deeper than six (the heading renders `h6`). */
export const tooDeep = (context: number | undefined) => context !== undefined && context > 6

/** Explicit level, else the context's, else 2; always 1–6. Warns about explicit values only. */
export function resolveHeadingLevel(
  explicit: number | undefined,
  context: number | undefined,
): HeadingLevel {
  if (explicit !== undefined) return validHeadingLevel(explicit)
  return clamp(context ?? ROOT_HEADING_LEVEL)
}

/** Warns once that the outline is deeper than six levels (the caller tracks "once"). */
export function warnTooDeep(context: number): void {
  warn(`the outline is ${context} levels deep; headings stop at h6 (aria-level 6)`)
}

/** Warns when an exposed heading has no text and no name attribute. */
export function warnEmptyHeading(el: Element): void {
  if (process.env.NODE_ENV === "production") return
  if (el.closest("[aria-hidden='true']")) return
  if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return
  if ((el.textContent ?? "").trim() !== "") return
  warn(`empty heading <${el.tagName.toLowerCase()}>: give it text or aria-label`)
}

export interface HeadingConnectInput {
  readonly level: HeadingLevel
  /** The rendered tag (lowercase); the server render passes the default element's. */
  readonly tag: string
  readonly instance: string
}

/**
 * `h{level}`: no role, no aria-level. Another heading element: aria-level only. Anything
 * else: role heading and aria-level.
 */
export function headingProps(input: Omit<HeadingConnectInput, "instance">): PartProps {
  const native = /^h[1-6]$/.test(input.tag)
  const matches = input.tag === `h${input.level}`
  return {
    role: native ? undefined : "heading",
    "aria-level": matches ? undefined : String(input.level),
    "data-level": String(input.level),
  }
}

export function headingConnect(input: HeadingConnectInput): PartProps {
  return { ...scopeAttrs("heading", "root", input.instance), ...headingProps(input) }
}
