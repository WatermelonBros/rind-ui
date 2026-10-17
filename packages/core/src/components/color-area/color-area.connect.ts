// Color Area parts (spec "Anatomy", "ARIA Semantics And Names", "Value Text", "Data Attributes
// And Variables"): every attribute, the positions and gradient (pure functions of the colour,
// so the server and the client render the same strings) and the key mapping.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenInputStyle } from "../../dom/visually-hidden"
import { formatChannel } from "../shared/color/channel-format"
import { channelRange, getChannel } from "../shared/color/channels"
import { type Color, type ColorMemory, makeColor } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { areaBlendMode, areaGradient } from "../shared/color/gradient"
import { type ColorNameProp, resolveColorName } from "../shared/color/name"
import { roundTo } from "../shared/step-math"
import { type AreaAxes, type AreaAxis, thumbPoint } from "./color-area.axes"
import type { ColorAreaEvent } from "./color-area.machine"
import type { ColorAreaMessages } from "./color-area.messages"

/**
 * The machine event for a key on an axis input, or null (not ours): arrows step (Left/Right
 * mirrored under RTL, Up increases), Shift a page, PageUp/PageDown the y page, Home/End the x
 * edges; Escape only while dragging.
 */
export function colorAreaKeyEvent(
  k: KeyDescription,
  options: { readonly dir: "ltr" | "rtl"; readonly dragging: boolean },
): ColorAreaEvent | null {
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  const rtl = options.dir === "rtl"
  const step = (axis: AreaAxis, steps: 1 | -1, page: boolean): ColorAreaEvent => ({
    type: "STEP",
    axis,
    steps,
    page,
    modality: "keyboard",
  })
  switch (k.key) {
    case "ArrowRight":
      return step("x", rtl ? -1 : 1, k.shift)
    case "ArrowLeft":
      return step("x", rtl ? 1 : -1, k.shift)
    case "ArrowUp":
      return step("y", 1, k.shift)
    case "ArrowDown":
      return step("y", -1, k.shift)
    case "PageUp":
      return step("y", 1, true)
    case "PageDown":
      return step("y", -1, true)
    case "Home":
      return { type: "EDGE", axis: "x", edge: "min" }
    case "End":
      return { type: "EDGE", axis: "x", edge: "max" }
    case "Escape":
      return options.dragging ? { type: "DRAG.CANCEL" } : null
    default:
      return null
  }
}

export interface ColorAreaConnectInput {
  readonly instance: string
  /** The working colour (in the axes' space). */
  readonly color: Color
  readonly memory?: ColorMemory | undefined
  readonly axes: AreaAxes
  readonly dir: "ltr" | "rtl"
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly dragging: boolean
  readonly focused: AreaAxis | null
  readonly tabStop: AreaAxis
  readonly changed: AreaAxis | "both" | null
  readonly modality: Modality
  readonly messages: ColorAreaMessages
  readonly locale: string
  readonly colorName?: ColorNameProp | undefined
  /** The consumer's name for the group. */
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
  readonly ariaDescribedBy?: string | undefined
  readonly ids: { readonly root: string; readonly input: (axis: AreaAxis) => string }
  readonly names?: { readonly x?: string | undefined; readonly y?: string | undefined }
  readonly form?: string | undefined
  /** The current `defaultValue` (the inputs' `value` attribute, for a form reset). */
  readonly defaultColor: Color
}

const pct = (f: number) => `${roundTo(f * 100, 4)}%`

export function colorAreaConnect(input: ColorAreaConnectInput) {
  const { color, axes, messages, locale, memory } = input
  const point = thumbPoint(color, axes, memory)
  const opaque = makeColor(color.space, color.channels, 1)
  const name = resolveColorName(opaque, messages, locale, input.colorName)
  const shared = {
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-dragging": dataFlag(input.dragging),
  }
  const focus = focusAttrs(input.focused !== null, input.modality)
  const part = (p: string) => scopeAttrs("color-area", p, input.instance)
  const gradient = areaGradient(color, axes.x, axes.y, { rtl: input.dir === "rtl", memory })
  const value = (axis: AreaAxis) => getChannel(color, axes[axis], memory)
  const channelText = (axis: AreaAxis | "z") => ({
    name: messages.channelName(axes[axis]),
    value: formatChannel(axes[axis], getChannel(color, axes[axis], memory), locale),
  })
  const valueText = (axis: AreaAxis) => {
    const other: AreaAxis = axis === "x" ? "y" : "x"
    const channels =
      input.changed === null
        ? [channelText(axis), channelText(other), channelText("z")]
        : input.changed === "both"
          ? [channelText(axis), channelText(other)]
          : [channelText(input.changed)]
    return messages.valueText({ channels, colorName: name })
  }
  const group = input.ariaLabel ?? null
  return {
    colorName: name,
    root: (): PartProps => ({
      ...part("root"),
      id: input.ids.root,
      role: "group",
      "aria-label":
        input.ariaLabel ?? (input.ariaLabelledBy === undefined ? messages.areaLabel : undefined),
      "aria-labelledby": input.ariaLabelledBy,
      dir: input.dir,
      ...shared,
      ...focus,
      style: {
        position: "relative",
        "touch-action": "none",
        "user-select": "none",
        "-webkit-user-select": "none",
        "--rind-color": formatColor(color, "css"),
        "--rind-color-opaque": formatColor(opaque, "css"),
      },
      [CRITICAL]: ["role"],
    }),
    background: (): PartProps => ({
      ...part("background"),
      ...shared,
      "aria-hidden": "true",
      style: {
        "background-image": gradient,
        "background-blend-mode": areaBlendMode(axes.x, axes.y),
        "--rind-color-area-gradient": gradient,
        "forced-color-adjust": "none",
      },
    }),
    thumb: (): PartProps => ({
      ...part("thumb"),
      ...shared,
      ...focus,
      style: {
        position: "absolute",
        left: pct(input.dir === "rtl" ? 1 - point.x : point.x),
        bottom: pct(point.y),
        translate: "-50% 50%",
        "touch-action": "none",
        "forced-color-adjust": "none",
        "--rind-color-area-x": String(roundTo(point.x * 100, 2)),
        "--rind-color-area-y": String(roundTo(point.y * 100, 2)),
        "--rind-color": formatColor(opaque, "css"),
      },
    }),
    /** An axis's native range input: one of the two `slider`s, one tab stop between them. */
    input: (
      axis: AreaAxis,
      own: {
        readonly ariaLabel?: string | undefined
        readonly ariaLabelledBy?: string | undefined
      } = {},
    ): PartProps => {
      const ch = axes[axis]
      const r = channelRange(color.space, ch)
      const consumer = own.ariaLabel !== undefined || own.ariaLabelledBy !== undefined
      const id = input.ids.input(axis)
      const channelName = messages.channelName(ch)
      return {
        ...part("input"),
        "data-axis": axis,
        "data-channel": ch,
        ...focusAttrs(input.focused === axis, input.modality),
        type: "range",
        id,
        min: r.min,
        max: r.max,
        step: r.step,
        name: input.names?.[axis],
        form: input.form,
        disabled: input.disabled || undefined,
        tabindex: input.tabStop === axis ? undefined : -1,
        defaultValue: String(getChannel(input.defaultColor, ch)),
        "aria-valuenow": value(axis),
        "aria-valuemin": r.min,
        "aria-valuemax": r.max,
        "aria-valuetext": valueText(axis),
        "aria-orientation": axis === "x" ? "horizontal" : "vertical",
        "aria-roledescription": messages.roleDescription,
        "aria-readonly": input.readOnly ? "true" : undefined,
        "aria-label": consumer
          ? own.ariaLabel
          : input.ariaLabelledBy !== undefined
            ? channelName
            : messages.inputLabel({ group, channel: channelName }),
        "aria-labelledby": consumer
          ? own.ariaLabelledBy
          : input.ariaLabelledBy !== undefined
            ? `${input.ariaLabelledBy} ${id}`
            : undefined,
        "aria-describedby": input.ariaDescribedBy,
        style: { ...visuallyHiddenInputStyle, "pointer-events": "none" },
        [CRITICAL]: ["type", "aria-valuenow", "aria-valuetext"],
      }
    },
  }
}

export type ColorAreaApi = ReturnType<typeof colorAreaConnect>
