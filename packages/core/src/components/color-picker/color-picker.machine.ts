// Color Picker coordinator (design §8): `closed` and `open` (inline is a prop: the machine
// stays closed and never opens; no Popover is rendered); three controllables —
// the colour (emitted in the space of `format`), the format and the open state (bound to the
// states). Every child sends its changes here: one commit path.

import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { type Color, type ColorMemory, makeColor } from "../shared/color/color"
import { colorMemory, toSpace } from "../shared/color/convert"
import { isEqualColor } from "../shared/color/equal"
import { tryParseColor } from "../shared/color/parse"
import { emittedChange, resolveWorking } from "../shared/color/value"

export type ColorPickerFormat = "hex" | "rgb" | "hsl" | "hsb"

export type ColorPickerReason =
  | "AREA"
  | "SLIDER"
  | "INPUT"
  | "SWATCH"
  | "EYEDROPPER"
  | "RESET"
  | "ADOPT"

/** Popover close reasons, plus "select" (a swatch pick with `closeOnSelect`). */
export type ColorPickerCloseReason = string

export type ColorPickerEvent =
  | { readonly type: "TRIGGER.PRESS" }
  | { readonly type: "OPEN"; readonly reason: string }
  | { readonly type: "CLOSE"; readonly reason: ColorPickerCloseReason }
  | {
      readonly type: "COLOR.SET"
      readonly color: Color
      readonly reason: ColorPickerReason
      readonly channel?: string | undefined
    }
  | { readonly type: "COLOR.COMMIT"; readonly reason: ColorPickerReason }
  | { readonly type: "FORMAT.SET"; readonly format: ColorPickerFormat }
  | { readonly type: "EYEDROPPER.RESULT"; readonly hex: string }
  | { readonly type: "RESET" }
  | { readonly type: "ADOPT"; readonly text: string }
  | { readonly type: "VALUE.SYNCED" }
  | { readonly type: "DISABLED" }

export interface ColorPickerMachineProps {
  readonly value?: Color | undefined
  readonly defaultValue?: Color | undefined
  readonly onValueChange?:
    | ((value: Color, details: ChangeDetails<ColorPickerEvent>) => void)
    | undefined
  readonly onValueCommit?:
    | ((value: Color, details: { readonly reason: ColorPickerReason }) => void)
    | undefined
  readonly format?: ColorPickerFormat | undefined
  readonly defaultFormat?: ColorPickerFormat | undefined
  readonly onFormatChange?:
    | ((format: ColorPickerFormat, details: ChangeDetails<ColorPickerEvent>) => void)
    | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<ColorPickerEvent>) => void)
    | undefined
  readonly inline?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly closeOnSelect?: boolean | undefined
}

export interface ColorPickerContext {
  /** The colour the children are given (the last edit's space, with memory). */
  working: Color | null
  memory: ColorMemory
  /** The last emission, until the controlled value arrives. */
  emitted: Color | null
  /** An emission since the last commit. */
  dirty: boolean
  pendingCommit: { readonly color: Color; readonly reason: ColorPickerReason } | null
}

type Args = ActionArgs<{
  props: ColorPickerMachineProps
  events: ColorPickerEvent
  env: Record<never, never>
  context: ColorPickerContext
  values: "value" | "format" | "open"
}>

export const BLACK = makeColor("rgb", [0, 0, 0])

/** The space a format emits in (`hex` and `rgb` emit `rgb`). */
export const formatSpace = (format: ColorPickerFormat) =>
  format === "hex" || format === "rgb" ? "rgb" : format

/** The emitted colour now: `value`, else `defaultValue`, else black. */
export const pickerValueOf = (props: ColorPickerMachineProps, value: Color | undefined): Color =>
  value ?? props.value ?? props.defaultValue ?? BLACK

/** The colour the children show. */
export function pickerWorking(
  props: ColorPickerMachineProps,
  context: Pick<ColorPickerContext, "working" | "memory">,
  value: Color | undefined,
): Color {
  const v = pickerValueOf(props, value)
  return resolveWorking(v, context.working, context.working?.space ?? v.space, context.memory)
}

const working = (a: Pick<Args, "props" | "context" | "values">) =>
  pickerWorking(a.props, a.context, a.values.value)
const emittedNow = (a: Pick<Args, "props" | "context" | "values">) =>
  a.context.emitted ?? pickerValueOf(a.props, a.values.value)

function setColor(args: Args, next: Color) {
  const { context, values, set } = args
  if (isEqualColor(working(args), next)) return
  const memory = colorMemory(next, context.memory)
  set("working", next)
  set("memory", memory)
  // Emitted in the space of the format, whatever space the consumer passed.
  const current = toSpace(emittedNow(args), formatSpace(values.format), memory)
  const emitted = emittedChange(current, next, memory)
  if (!emitted) return
  set("emitted", emitted)
  set("dirty", true)
  set("value", emitted)
}

function commit(args: Args, reason: ColorPickerReason) {
  const { context, props, set } = args
  if (!context.dirty) return
  set("dirty", false)
  const color = emittedNow(args)
  if (props.value !== undefined && !isEqualColor(props.value, color)) {
    set("pendingCommit", { color, reason })
    return
  }
  props.onValueCommit?.(color, { reason })
}

const canOpen = (props: ColorPickerMachineProps) =>
  props.disabled !== true && props.readOnly !== true && props.inline !== true

export const colorPickerMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ColorPickerMachineProps
    events: ColorPickerEvent
    env: Record<never, never>
    context: ColorPickerContext
    values: "value" | "format" | "open"
  }>(),
  guards: {
    canOpen: ({ props }) => canOpen(props),
    canChange: ({ props }) => props.disabled !== true && props.readOnly !== true,
    closeOnSelect: ({ props, event }) =>
      props.closeOnSelect === true && event.type === "COLOR.COMMIT" && event.reason === "SWATCH",
  },
  actions: {
    setColor: (args) => {
      if (args.event.type === "COLOR.SET") setColor(args, args.event.color)
    },
    commit: (args) => {
      if (args.event.type === "COLOR.COMMIT") commit(args, args.event.reason)
    },
    setFormat: ({ event, set }) => {
      if (event.type === "FORMAT.SET") set("format", event.format)
    },
    /** The eye dropper's colour: opaque (zag#2782), set and committed at once. */
    setPicked: (args) => {
      if (args.event.type !== "EYEDROPPER.RESULT") return
      const picked = tryParseColor(args.event.hex)
      if (!picked) return
      setColor(args, makeColor(picked.space, picked.channels, 1))
      commit(args, "EYEDROPPER")
    },
    restoreDefault: ({ props, set }) => {
      set("working", null)
      set("emitted", null)
      set("dirty", false)
      set("pendingCommit", null)
      if (props.value === undefined) set("value", props.defaultValue ?? BLACK)
    },
    adopt: (args) => {
      if (args.event.type !== "ADOPT") return
      const c = tryParseColor(args.event.text)
      if (!c) return
      setColor(args, c)
      commit(args, "ADOPT")
    },
    applySynced: ({ props, context, set }) => {
      set("emitted", null)
      const pending = context.pendingCommit
      if (pending && props.value !== undefined) {
        set("pendingCommit", null)
        if (isEqualColor(props.value, pending.color)) {
          props.onValueCommit?.(props.value, { reason: pending.reason })
        }
      }
    },
    revert: ({ event, set }) => {
      if (event.type !== "$reverted" || event.key !== "value") return
      set("emitted", null)
      set("working", null)
      set("dirty", false)
      set("pendingCommit", null)
    },
  },
}).machine({
  id: "color-picker",
  initial: "closed",
  context: () => ({ working: null, memory: {}, emitted: null, dirty: false, pendingCommit: null }),
  values: {
    // `pickerValueOf` resolves a missing colour from the props (sound: every reader uses it).
    value: { fallback: undefined as never, equal: (a, b) => isEqualColor(a, b) },
    format: { fallback: "hex" },
    open: { fallback: false, states: { open: true, closed: false } },
  },
  onProps: { value: "VALUE.SYNCED", disabled: "DISABLED" },
  on: {
    "COLOR.SET": { guard: "canChange", actions: ["setColor"] },
    "COLOR.COMMIT": { actions: ["commit"] },
    "FORMAT.SET": { actions: ["setFormat"] },
    "EYEDROPPER.RESULT": { guard: "canChange", actions: ["setPicked"] },
    RESET: { actions: ["restoreDefault"] },
    ADOPT: { actions: ["adopt"] },
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    closed: {
      on: {
        "TRIGGER.PRESS": { guard: "canOpen", target: "open" },
        OPEN: { guard: "canOpen", target: "open" },
      },
    },
    open: {
      on: {
        "TRIGGER.PRESS": { target: "closed" },
        CLOSE: { target: "closed" },
        DISABLED: { target: "closed", reason: "api" },
        // A swatch pick with closeOnSelect closes after its commit (reason "select").
        "COLOR.COMMIT": [
          { guard: "closeOnSelect", target: "closed", actions: ["commit"], reason: "select" },
          { actions: ["commit"] },
        ],
      },
    },
  },
})

export type ColorPickerMachine = typeof colorPickerMachine
