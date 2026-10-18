// Native key events → logical machine events, with right-to-left mirroring, the platform
// modifier and composition decided once, outside machines. Pure: runs without a DOM. One
// of the three modules allowed to read platform flags (the `mod` key and the macOS
// Control+click context-menu rule are platform conventions, not workarounds).

import type { PlatformFlags } from "../env/capabilities"
import type { LogicalKey, LogicalKeyEvent } from "./events"

/** What the mapping reads from a key event. */
export interface KeyDescription {
  readonly key: string
  readonly code: string
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly repeat: boolean
  /** An IME is composing (isComposing, keyCode 229, or Safari's late commit Enter). */
  readonly composing: boolean
}

export interface KeyContext {
  readonly dir: "ltr" | "rtl"
  /**
   * The composite's main axis; the other axis expands and collapses. `"grid"`: both axes
   * move, along a row (`NEXT`/`PREV`, mirrored in rtl) and across rows (`NEXT_ROW`/`PREV_ROW`).
   */
  readonly orientation: "horizontal" | "vertical" | "both" | "grid"
  readonly platform: PlatformFlags
  /**
   * A value control (slider, spinbutton): arrows increase and decrease. `"vertical"`: only
   * ArrowUp/ArrowDown step; ArrowLeft/ArrowRight move (`PREV`/`NEXT`, mirrored in rtl), as
   * in a segmented date field.
   */
  readonly value?: boolean | "vertical"
}

/** Meta (⌘) on Apple platforms, Control elsewhere. */
export const isMod = (k: Pick<KeyDescription, "ctrl" | "meta">, platform: PlatformFlags) =>
  // platform-convention: the primary shortcut modifier is ⌘ on Apple, Control elsewhere
  platform.apple ? k.meta : k.ctrl

/** Control+click on macOS is a context-menu request, not a press. */
export const isContextMenuClick = (
  e: { readonly button: number; readonly ctrlKey: boolean },
  platform: PlatformFlags,
  // platform-convention: Control+click is the secondary click on macOS
) => platform.mac && e.button === 0 && e.ctrlKey

/** Only horizontal arrows mirror, and only in rtl. */
const forward = (dir: KeyContext["dir"]) => (dir === "rtl" ? "ArrowLeft" : "ArrowRight")
const backward = (dir: KeyContext["dir"]) => (dir === "rtl" ? "ArrowRight" : "ArrowLeft")

export function toLogicalKey(k: KeyDescription, c: KeyContext): LogicalKey | undefined {
  const { key } = k
  if (key === "ContextMenu" || (key === "F10" && k.shift)) return "CONTEXT_MENU"
  if (key === "Home") return "FIRST"
  if (key === "End") return "LAST"
  if (key === "PageDown") return "PAGE_NEXT"
  if (key === "PageUp") return "PAGE_PREV"
  if (key === "Enter" || key === " ") return "ACTIVATE"
  if (key === "Escape") return "DISMISS"
  if (c.value === "vertical") {
    if (key === "ArrowUp") return "INCREASE"
    if (key === "ArrowDown") return "DECREASE"
    if (key === "ArrowLeft" || key === "ArrowRight") return key === forward(c.dir) ? "NEXT" : "PREV"
    return undefined
  }
  if (c.value) {
    // ArrowUp always increases; horizontally, the reading direction's end increases.
    if (key === "ArrowUp" || key === forward(c.dir)) return "INCREASE"
    if (key === "ArrowDown" || key === backward(c.dir)) return "DECREASE"
    return undefined
  }
  const vertical = key === "ArrowUp" || key === "ArrowDown"
  const horizontal = key === "ArrowLeft" || key === "ArrowRight"
  if (c.orientation === "grid") {
    // A day along the row, a week across rows (rows never mirror).
    if (vertical) return key === "ArrowDown" ? "NEXT_ROW" : "PREV_ROW"
    if (horizontal) return key === forward(c.dir) ? "NEXT" : "PREV"
    return undefined
  }
  if (vertical && (c.orientation === "vertical" || c.orientation === "both")) {
    return key === "ArrowDown" ? "NEXT" : "PREV"
  }
  if (horizontal && (c.orientation === "horizontal" || c.orientation === "both")) {
    return key === forward(c.dir) ? "NEXT" : "PREV"
  }
  // The cross axis expands and collapses (tree items, menubar submenus).
  if (horizontal) return key === forward(c.dir) ? "EXPAND" : "COLLAPSE"
  if (vertical) return key === "ArrowDown" ? "EXPAND" : "COLLAPSE"
  return undefined
}

/** The machine event for a key, with modality, modifiers, `mod` and `composing`. */
export function toLogicalKeyEvent(k: KeyDescription, c: KeyContext): LogicalKeyEvent | undefined {
  const type = toLogicalKey(k, c)
  if (!type) return undefined
  return {
    type,
    modality: "keyboard",
    shift: k.shift,
    alt: k.alt,
    ctrl: k.ctrl,
    meta: k.meta,
    mod: isMod(k, c.platform),
    composing: k.composing,
  }
}
