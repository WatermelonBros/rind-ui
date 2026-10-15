// Separator has no machine (design §1): one pure function decides every separator's
// attributes, here and in every component that draws a divider (Toolbar, Menu, the
// listbox popups), so their role and orientation rules cannot drift.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"

declare const process: { env: { NODE_ENV?: string } }

export type SeparatorOrientation = "horizontal" | "vertical"
/** Where the separator is drawn: a listbox allows only options and groups as children. */
export type SeparatorContext = "content" | "menu" | "toolbar" | "listbox"

export interface SeparatorInput {
  /** Undefined: the container's default, else horizontal. */
  readonly orientation?: unknown
  /** Supplied by the container (a horizontal toolbar's separators are vertical). */
  readonly defaultOrientation?: SeparatorOrientation | undefined
  readonly decorative?: boolean | undefined
  /** The rendered tag (lowercase); the server render passes the declared element's. */
  readonly tag: string
  readonly context?: SeparatorContext | undefined
  /** `separator` (its own part `root`) or the host's scope (part `separator`). */
  readonly scope?: string | undefined
  readonly instance: string
  /** The consumer's props the warnings read. */
  readonly own?: Readonly<Record<string, unknown>> | undefined
}

const warn = (message: string) => console.warn(`[rind-ui] separator: ${message}`)

const VALUE_ATTRS = ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]

const isNone = (input: SeparatorInput) => input.decorative === true || input.context === "listbox"
const isNamed = (own: Readonly<Record<string, unknown>>) =>
  own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined

/** The orientation: explicit (valid) wins, then the container's default, then horizontal. */
export function separatorOrientation(
  orientation: unknown,
  defaultOrientation?: SeparatorOrientation,
): SeparatorOrientation {
  if (orientation === "horizontal" || orientation === "vertical") return orientation
  return orientation === undefined ? (defaultOrientation ?? "horizontal") : "horizontal"
}

/**
 * Development warnings, kept out of the pure props (a framework calls them once per
 * change, not per render): an invalid orientation, a focusable or valued separator
 * (→ Splitter), a name on a `none` separator (dropped).
 */
export function separatorWarnings(input: SeparatorInput): void {
  if (process.env.NODE_ENV === "production") return
  const o = input.orientation
  if (o !== undefined && o !== "horizontal" && o !== "vertical") {
    warn(`orientation ${JSON.stringify(o)} is not "horizontal" or "vertical"; using "horizontal"`)
  }
  const own = input.own ?? {}
  const tabIndex = own["tabIndex"] ?? own["tabindex"]
  if (
    (typeof tabIndex === "number" && tabIndex >= 0) ||
    VALUE_ATTRS.some((a) => own[a] !== undefined)
  ) {
    warn(
      "a focusable separator with a value is a window splitter: use the Splitter component for resizable dividers",
    )
  }
  if (isNone(input) && isNamed(own)) {
    warn("a decorative separator (role none) cannot be named; the name is dropped")
  }
}

/** The consumer props a `none` separator must not carry (its name). */
export const droppedNameProps = (input: SeparatorInput): readonly string[] =>
  isNone(input) ? ["aria-label", "aria-labelledby"] : []

/**
 * `role="separator"` (none on `<hr>`, implicit) with `aria-orientation` only when vertical;
 * `role="none"` when decorative or in a listbox, without orientation (and, through
 * `droppedNameProps`, without name). Pure: the warnings are `separatorWarnings`.
 */
export function separatorProps(input: SeparatorInput): PartProps {
  const orientation = separatorOrientation(input.orientation, input.defaultOrientation)
  const none = isNone(input)
  const scope = input.scope ?? "separator"
  return {
    ...scopeAttrs(scope, scope === "separator" ? "root" : "separator", input.instance),
    role: none ? "none" : input.tag === "hr" ? undefined : "separator",
    "aria-orientation": !none && orientation === "vertical" ? "vertical" : undefined,
    "data-orientation": orientation,
    "data-decorative": dataFlag(none),
  }
}

export const separatorConnect = (input: Omit<SeparatorInput, "scope">) => ({
  root: (): PartProps => separatorProps({ ...input, scope: "separator" }),
})
