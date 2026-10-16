// Key ownership (design §2): which keydowns the toolbar acts on. Pure: the caller reads
// the target and the caret; this decides.

import { type KeyContext, type KeyDescription, toLogicalKey } from "../../a11y/keys"

export type ToolbarMove = "next" | "previous" | "first" | "last"

export interface ToolbarKeyTarget {
  /** The keydown's target is one of the toolbar's own (registered) controls. */
  readonly isControl: boolean
  /** The target is a text field: its caret, else null. */
  readonly textField: {
    readonly value: number
    readonly start: number
    readonly end: number
  } | null
}

export function toolbarKeyAction(
  key: KeyDescription & { readonly defaultPrevented?: boolean },
  target: ToolbarKeyTarget,
  opts: Omit<KeyContext, "value" | "orientation"> & {
    readonly orientation: "horizontal" | "vertical"
  },
): ToolbarMove | null {
  if (!target.isControl || key.alt || key.ctrl || key.meta || key.composing) return null
  if (key.defaultPrevented === true) return null
  const logical = toLogicalKey(key, opts)
  const field = target.textField
  if (logical === "FIRST" || logical === "LAST") {
    // Home and End belong to a text field.
    return field ? null : logical === "FIRST" ? "first" : "last"
  }
  if (logical !== "NEXT" && logical !== "PREV") return null
  if (field) {
    // Only from a collapsed caret at the end the arrow points to (react-spectrum#7937).
    if (key.shift || field.start !== field.end) return null
    if (logical === "NEXT" && field.end !== field.value) return null
    if (logical === "PREV" && field.start !== 0) return null
  }
  return logical === "NEXT" ? "next" : "previous"
}
