// Marquee parts (add-marquee design §3): the Viewport clips a row (or column) of copies the
// theme translates by -100% of their own size; only the first copy is exposed. Structural
// styles live here so the band works unthemed; motion lives in the theme.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { MarqueeMessages } from "./marquee.messages"

export type MarqueePart = "root" | "pause-trigger" | "viewport" | "content"
export type MarqueeState = "idle" | "running" | "paused" | "static"
export type MarqueeOrientation = "horizontal" | "vertical"

export interface MarqueeConnectInput {
  readonly instance: string
  readonly state: MarqueeState
  /** The user pause (not a hover). */
  readonly paused: boolean
  readonly orientation: MarqueeOrientation
  readonly reverse: boolean
  readonly autoFill: boolean
  /** Seconds, once measured. */
  readonly duration: number | null
  readonly ids: { readonly viewport: string }
  readonly messages: MarqueeMessages
}

export function marqueeConnect(input: MarqueeConnectInput) {
  const horizontal = input.orientation === "horizontal"
  const still = input.state === "static"
  const part = (name: MarqueePart): PartProps => ({
    ...scopeAttrs("marquee", name, input.instance),
    "data-state": input.state,
    "data-orientation": input.orientation,
    "data-reverse": dataFlag(input.reverse),
  })
  const gap = "var(--rind-marquee-gap, 1rem)"
  return {
    root: (): PartProps => part("root"),
    pauseTrigger: (focus: {
      readonly focused: boolean
      readonly modality: Modality
    }): PartProps => ({
      ...part("pause-trigger"),
      ...focusAttrs(focus.focused, focus.modality),
      type: "button",
      "aria-label": input.paused ? input.messages.play : input.messages.pause,
      "data-paused": dataFlag(input.paused),
      hidden: still || undefined,
    }),
    viewport: (): PartProps => ({
      ...part("viewport"),
      id: input.ids.viewport,
      style: {
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        overflow: still ? "visible" : "clip",
        // Its size never depends on its copies (RFM#66).
        ...(horizontal ? { contain: "inline-size" } : {}),
        ...(input.duration === null ? {} : { "--rind-marquee-duration": `${input.duration}s` }),
      },
    }),
    /** Copy `index` (0 is the original, exposed; the rest are hidden copies). */
    content: (index: number): PartProps => ({
      ...part("content"),
      "data-index": String(index),
      "data-copy": index > 0 ? "" : undefined,
      "aria-hidden": index > 0 ? "true" : undefined,
      style: {
        display: "flex",
        // Still, the one copy fits the viewport and wraps; moving, a copy never shrinks.
        flexShrink: still ? 1 : 0,
        flexDirection: horizontal ? "row" : "column",
        gap,
        // The trailing gap is part of the copy, so -100% lands on the next copy.
        ...(horizontal ? { paddingInlineEnd: gap } : { paddingBlockEnd: gap }),
        ...(input.autoFill || still
          ? {}
          : horizontal
            ? { minInlineSize: "100%" }
            : { minBlockSize: "100%" }),
        ...(still ? { flexWrap: "wrap", minInlineSize: 0 } : {}),
      },
    }),
  }
}
