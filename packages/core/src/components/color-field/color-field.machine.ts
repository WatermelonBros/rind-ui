// Color Field (design §6): `idle` (the text is the value's), `editing` (a dirty draft) and
// `invalid` (a draft that did not parse). The value changes only at commit points: Enter, blur
// and `flush` (react-spectrum#5484, #10445, #9748).

import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import type { Color, ColorMemory, ColorSpace } from "../shared/color/color"
import { colorMemory, toSpace } from "../shared/color/convert"
import { isEqualColor } from "../shared/color/equal"
import { type ColorFieldFormat, commitAlpha, parseColorText } from "./color-field.text"

export type ColorFieldEvent =
  /** An accepted edit of the text. */
  | { readonly type: "INPUT"; readonly text: string }
  /** Enter. */
  | { readonly type: "COMMIT" }
  | { readonly type: "BLUR" }
  /** The owner asks for the draft (a picker closing): valid commits, the rest is discarded. */
  | { readonly type: "FLUSH" }
  /** Escape on a dirty draft: the value's text again. */
  | { readonly type: "ESCAPE" }
  | { readonly type: "RESET" }
  /** A native change on the hidden input we did not make (autofill). */
  | { readonly type: "ADOPT"; readonly text: string }

export interface ColorFieldMachineProps {
  readonly value?: Color | null | undefined
  readonly defaultValue?: Color | null | undefined
  readonly onValueChange?:
    | ((value: Color | null, details: ChangeDetails<ColorFieldEvent>) => void)
    | undefined
  readonly onInputValueChange?: ((text: string) => void) | undefined
  readonly format: ColorFieldFormat
  readonly alpha: boolean
  /** The space a colour is emitted in when there is no value yet (default: the parsed one's). */
  readonly colorSpace?: ColorSpace | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface ColorFieldContext {
  draft: string
  memory: ColorMemory
}

/**
 * "No colour" as a controllable value: the runtime types values as non-null, but `null` is a
 * value here (a cleared field), as Radio Group's nothing-checked (the cast is sound: every
 * reader goes through `colorFieldValue`, which accepts null).
 */
const NONE = null as unknown as Color

type Args = ActionArgs<{
  props: ColorFieldMachineProps
  events: ColorFieldEvent
  env: Record<never, never>
  context: ColorFieldContext
  values: "value"
}>

/** The field's colour: the value, else the default, else none. */
export const colorFieldValue = (
  props: ColorFieldMachineProps,
  value: Color | null | undefined,
): Color | null => (value !== undefined ? value : (props.value ?? props.defaultValue ?? null))

const current = (args: Pick<Args, "props" | "values">) =>
  colorFieldValue(args.props, args.values.value)

const parsedDraft = (args: Pick<Args, "props" | "context">) =>
  parseColorText(args.context.draft, args.props.format, args.props.alpha)

function commit(args: Args) {
  const { props, context, set } = args
  const parsed = parsedDraft(args)
  if (parsed === undefined) return
  const now = current(args)
  if (parsed === null) {
    if (now !== null) set("value", NONE)
    return
  }
  const next = commitAlpha(parsed, context.draft, now, props.alpha)
  const space = now?.space ?? props.colorSpace
  const emitted = space ? toSpace(next, space, context.memory) : next
  set("memory", colorMemory(emitted, context.memory))
  if (!isEqualColor(emitted, now)) set("value", emitted)
}

export const colorFieldMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ColorFieldMachineProps
    events: ColorFieldEvent
    env: Record<never, never>
    context: ColorFieldContext
    values: "value"
  }>(),
  guards: {
    editable: ({ props }) => props.disabled !== true && props.readOnly !== true,
    draftInvalid: (args) => parsedDraft(args) === undefined,
    /** Flushing: an empty draft is discarded, not committed as "no colour". */
    draftUnusable: (args) => {
      const p = parsedDraft(args)
      return p === undefined || p === null
    },
  },
  actions: {
    setDraft: ({ event, props, set }) => {
      if (event.type !== "INPUT") return
      set("draft", event.text)
      props.onInputValueChange?.(event.text)
    },
    commit,
    restoreDefault: ({ props, set, values }) => {
      set("draft", "")
      const d = props.defaultValue ?? null
      if (!isEqualColor(d, colorFieldValue(props, values.value))) set("value", d ?? NONE)
    },
    adopt: (args) => {
      const { event, set } = args
      if (event.type !== "ADOPT") return
      set("draft", event.text)
      commit(args)
      set("draft", "")
    },
  },
}).machine({
  id: "color-field",
  initial: "idle",
  context: () => ({ draft: "", memory: {} }),
  values: { value: { fallback: NONE } },
  on: {
    RESET: { target: "idle", actions: ["restoreDefault"] },
    ADOPT: { target: "idle", actions: ["adopt"] },
  },
  states: {
    idle: {
      on: { INPUT: { guard: "editable", target: "editing", actions: ["setDraft"] } },
    },
    editing: {
      on: {
        INPUT: { guard: "editable", actions: ["setDraft"] },
        COMMIT: [
          { guard: "draftInvalid", target: "invalid" },
          { target: "idle", actions: ["commit"] },
        ],
        BLUR: [
          { guard: "draftInvalid", target: "invalid" },
          { target: "idle", actions: ["commit"] },
        ],
        FLUSH: [
          { guard: "draftUnusable", target: "idle" },
          { target: "idle", actions: ["commit"] },
        ],
        ESCAPE: { target: "idle" },
      },
    },
    invalid: {
      on: {
        INPUT: { guard: "editable", target: "editing", actions: ["setDraft"] },
        FLUSH: { target: "idle" },
        ESCAPE: { target: "idle" },
      },
    },
  },
})

export type ColorFieldMachine = typeof colorFieldMachine
