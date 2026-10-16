// The hover-intent capability (hover-intent spec): decides from pointer movement when a
// hover-opened layer is hovered. Machines receive only HOVER.START / HOVER.END, so they run
// in Node with a fake. Delays live in each consumer's machine as `after` transitions.
//
// STABLE API: Tooltip, Hover Card and later submenus and Navigation Menu depend on it.
// Changes are additive only (new optional fields).

import type { LayerHandle } from "../dom/layer-stack"
import type { RectLike } from "./position"

export interface HoverIntentTrackOptions {
  readonly trigger: () => Element | null
  /** The layer's own elements: positioner, content, arrow. */
  readonly elements: () => readonly Element[]
  /** Descendant layers count as inside; while one is open, leaving is not reported. */
  readonly layer: LayerHandle
  /** The pointer left the hover zone (the machine: HOVER.END). */
  readonly onLeave: () => void
  /** The pointer came back into the hover zone (the machine: HOVER.START). */
  readonly onEnter: () => void
  /**
   * The content's rectangle as actually placed (after flipping or shifting); default: the
   * bounding box of `elements()`.
   */
  readonly target?: (() => RectLike | null) | undefined
  /** The grace area ends after the pointer rests inside it this long (ms). */
  readonly restMs?: number | undefined
}

/** The trigger's own handlers (the only listeners while closed). */
export interface HoverTriggerProps {
  onPointerMove(event: {
    readonly pointerType: string
    readonly currentTarget: EventTarget | null
    readonly clientX?: number
    readonly clientY?: number
  }): void
  onPointerLeave(event: { readonly pointerType: string }): void
}

export interface HoverIntent {
  /** While open: tracks the zone and reports leave / re-enter; returns the cleanup. */
  track(options: HoverIntentTrackOptions): () => void
  /** The pointer is travelling inside some layer's grace area in this document. */
  isInTransit(doc: Document): boolean
  /** Movement-based HOVER.START (mouse and pen only), pointerleave → HOVER.END. */
  triggerProps(
    send: (event: { readonly type: "HOVER.START" | "HOVER.END" }) => void,
  ): HoverTriggerProps
}

export interface HoverIntentEnv {
  readonly hoverIntent: HoverIntent
}
