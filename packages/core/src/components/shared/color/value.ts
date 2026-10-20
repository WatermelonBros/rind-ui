// The "Controlled Colour Value" rule (color-model) as helpers and one small machine. The
// controllable `value` holds the colour in its emission space (the space the consumer gave);
// the colour the controls show is a working-space colour in context, kept with its hue and
// saturation. The Echo rule is a derivation: a value that is the same sRGB colour in another
// space as the working colour keeps the working colour (zag#2503, react-spectrum#9509).

import { setup, type } from "../../../machine/setup"
import type { ChangeDetails } from "../../../machine/types"
import type { Color, ColorMemory, ColorSpace } from "./color"
import { colorMemory, toSpace } from "./convert"
import { isEqualColor, isSameColor } from "./equal"

/**
 * The working colour the controls show for `value`: the internal one when `value` is its echo
 * (another space, same sRGB colour) or equal to it; otherwise `value` converted with memory.
 */
export function resolveWorking(
  value: Color,
  working: Color | null,
  space: ColorSpace,
  memory?: ColorMemory,
): Color {
  if (working) {
    if (value.space === working.space) {
      if (isEqualColor(value, working)) return working
    } else if (isSameColor(value, working)) {
      return working
    }
  }
  return toSpace(value, space, memory)
}

/**
 * What a change to `next` (a working-space colour) emits: the colour in the emission space of
 * `current`, or `null` when the emitted colour would not change (a hue moved at black).
 */
export function emittedChange(current: Color, next: Color, memory?: ColorMemory): Color | null {
  const emitted = toSpace(next, current.space, memory)
  return isEqualColor(emitted, current) ? null : emitted
}

/** Why a colour changed, as consumers see it. */
export interface ColorChangeDetails<R extends string = string> {
  readonly reason: R
  /** The working space the change was made in. */
  readonly space: ColorSpace
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

export interface ColorCommitDetails<R extends string = string> {
  readonly reason: R
}

// --- One controllable colour with commits: Color Slider, Channel Field, Swatch Picker ---

export type ColorValueEvent =
  /** A user change to `color` (any space; converted to the working space). */
  | { readonly type: "SET"; readonly color: Color; readonly reason: string }
  /** The end of an interaction: commits when the emitted colour changed since the last commit. */
  | { readonly type: "COMMIT"; readonly reason: string }
  /** A form reset: back to the default, no callback. */
  | { readonly type: "RESET" }
  | { readonly type: "VALUE.SYNCED" }

export interface ColorValueProps {
  readonly value?: Color | undefined
  readonly defaultValue?: Color | undefined
  readonly onValueChange?:
    | ((value: Color, details: ChangeDetails<ColorValueEvent>) => void)
    | undefined
  readonly onValueCommit?: ((value: Color, details: ColorCommitDetails) => void) | undefined
  /** The space the controls edit in. */
  readonly space: ColorSpace
  /** The colour used when neither `value` nor `defaultValue` is given. */
  readonly fallback: Color
}

export interface ColorValueContext {
  /** The colour the controls show, in the working space; null until the first change. */
  working: Color | null
  memory: ColorMemory
  /** An emission since the last commit, waiting for the end of the interaction. */
  dirty: Color | null
  /** A commit waiting for the controlled value to arrive. */
  pendingCommit: { readonly color: Color; readonly reason: string } | null
}

/** The colour value in its emission space (`value`, else `defaultValue`, else the fallback). */
export const colorValueOf = (props: ColorValueProps, value: Color | undefined): Color =>
  value ?? props.value ?? props.defaultValue ?? props.fallback

/** The working colour shown for the machine's current value. */
export const workingOf = (props: ColorValueProps, context: ColorValueContext, value: Color) =>
  resolveWorking(value, context.working, props.space, context.memory)

export const colorValueMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ColorValueProps
    events: ColorValueEvent
    env: Record<never, never>
    context: ColorValueContext
    values: "value"
  }>(),
  actions: {
    setColor: ({ event, props, context, values, set }) => {
      if (event.type !== "SET") return
      const current = colorValueOf(props, values.value)
      const next = toSpace(event.color, props.space, context.memory)
      const memory = colorMemory(next, context.memory)
      set("working", next)
      set("memory", memory)
      const emitted = emittedChange(current, next, memory)
      if (!emitted) return
      set("dirty", emitted)
      set("value", emitted)
    },
    commit: ({ event, props, context, values, set }) => {
      if (event.type !== "COMMIT") return
      const dirty = context.dirty
      set("dirty", null)
      if (!dirty) return
      const current = colorValueOf(props, values.value)
      if (isEqualColor(current, dirty)) props.onValueCommit?.(current, { reason: event.reason })
      else if (props.value !== undefined)
        set("pendingCommit", { color: dirty, reason: event.reason })
    },
    applySynced: ({ props, context, set }) => {
      const pending = context.pendingCommit
      if (!pending || props.value === undefined) return
      set("pendingCommit", null)
      if (isEqualColor(props.value, pending.color)) {
        props.onValueCommit?.(props.value, { reason: pending.reason })
      }
    },
    forget: ({ set }) => {
      set("dirty", null)
      set("pendingCommit", null)
    },
    restoreDefault: ({ props, set }) => {
      set("working", null)
      set("dirty", null)
      set("pendingCommit", null)
      // Reported with reason RESET (adapters that must stay silent filter it); never committed.
      if (props.value === undefined) set("value", props.defaultValue ?? props.fallback)
    },
  },
}).machine({
  id: "color-value",
  initial: "idle",
  context: () => ({ working: null, memory: {}, dirty: null, pendingCommit: null }),
  // No fallback colour here: `colorValueOf` resolves a missing value from the props (the cast is
  // sound because every reader goes through `colorValueOf`).
  values: { value: { fallback: undefined as never, equal: (a, b) => isEqualColor(a, b) } },
  onProps: { value: "VALUE.SYNCED" },
  states: {
    idle: {
      on: {
        SET: { actions: ["setColor"] },
        COMMIT: { actions: ["commit"] },
        RESET: { actions: ["restoreDefault"] },
        "VALUE.SYNCED": { actions: ["applySynced"] },
        $reverted: { actions: ["forget"] },
      },
    },
  },
})

export type ColorValueMachine = typeof colorValueMachine
