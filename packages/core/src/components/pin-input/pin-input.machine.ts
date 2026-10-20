// Pin Input (design §3): one native input over presentational slots. Insertions are planned
// (edit-plan.ts) before the browser applies them and arrive as EDIT; everything the browser
// writes itself (a deletion, undo, autofill, a password manager's script fill) arrives as
// INPUT and is normalised. While an IME composes the browser owns the text; the committed
// text is applied once at its end.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import { normaliseWrite, type PinEdit, type PinRules, planEdit } from "./edit-plan"
import type { PinInputMessages } from "./pin-input.messages"

export type PinInputReason = "INPUT" | "PASTE" | "AUTOFILL" | "RESET"

export type PinInputEvent =
  /** A planned insertion (the browser's own was prevented). */
  | { readonly type: "EDIT"; readonly edit: PinEdit }
  /** A refused insertion: nothing changes. */
  | { readonly type: "INVALID"; readonly text: string }
  /** The browser wrote the input itself: a native deletion or undo (INPUT), or a fill. */
  | { readonly type: "INPUT"; readonly text: string; readonly reason: "INPUT" | "AUTOFILL" }
  /** The input's caret moved (collapsed index). */
  | { readonly type: "CARET"; readonly index: number }
  /** A press on the slot at `index` (by geometry). */
  | { readonly type: "SLOT.PRESS"; readonly index: number; readonly modality: Modality }
  | { readonly type: "COMPOSITION.START"; readonly caret: number }
  | { readonly type: "COMPOSITION.END"; readonly text: string }
  | { readonly type: "FOCUS"; readonly modality: Modality }
  | { readonly type: "BLUR" }
  /** A form reset: the current `defaultValue` comes back. */
  | { readonly type: "RESET" }

export interface PinInputProps extends PinRules {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | undefined
  /** Translated by the adapter into `(value, { reason })`. */
  readonly onValueChange?: ((value: string, details: unknown) => void) | undefined
  /** An insertion was refused (its text). */
  readonly onValueInvalid?: ((text: string) => void) | undefined
  /** A user change completed the code (base-ui#4679). */
  readonly onValueComplete?: ((value: string) => void) | undefined
  readonly autoSubmit?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly messages: PinInputMessages
  readonly id: string
  /** Writes the collapsed caret once the value is rendered (same task). */
  readonly writeCaret: (index: number) => void
  /** Puts the rendered value back into the input (a refused browser write). */
  readonly resync: () => void
  /** `form.requestSubmit()` of the input's form; never moves focus (base-ui#5088). */
  readonly requestSubmit?: (() => void) | undefined
}

export interface PinInputContext {
  /** The collapsed caret, 0 to the value's length. */
  caret: number
  /** Where the composition started (its text is inserted there). */
  compositionCaret: number
  focused: boolean
}

type Types = {
  props: PinInputProps
  events: PinInputEvent
  env: Record<never, never>
  context: PinInputContext
  values: "value"
}
type Args = ActionArgs<Types>

const editable = (props: PinInputProps) => props.disabled !== true && props.readOnly !== true

/**
 * What a fill wrote: the DOM text, or, when it was inserted at the caret into a partial code
 * ("12" + "534418"), the inserted part alone once it is code-sized (an SMS or password-manager
 * fill replaces the code, it never mixes with it: WCAG 3.3.8).
 */
export function fillOf(
  previous: string,
  text: string,
  rules: Pick<PinInputProps, "length">,
): string {
  let start = 0
  while (start < previous.length && start < text.length && previous[start] === text[start]) start++
  let end = 0
  while (
    end < previous.length - start &&
    end < text.length - start &&
    previous[previous.length - 1 - end] === text[text.length - 1 - end]
  ) {
    end++
  }
  const inserted = text.slice(start, text.length - end)
  return inserted.replace(/[\s.-]/g, "").length >= rules.length ? inserted : text
}

/** Writes a user change, then completes when it filled the code (base-ui#4679). */
function apply(args: Args, next: string, caret: number, replaced: boolean) {
  const previous = args.values.value
  args.set("value", next)
  args.set("caret", caret)
  args.props.writeCaret(caret)
  const { length } = args.props
  if (next.length === length && (previous.length < length || (replaced && next !== previous))) {
    args.props.onValueComplete?.(next)
    if (args.props.autoSubmit) args.props.requestSubmit?.()
  }
}

/** The value, at most `length` long, of accepted characters only (controlled input: ark#3573). */
export function renderedValue(
  props: Pick<PinInputProps, "length" | "validationType" | "pattern" | "sanitize">,
  value: string | null | undefined,
) {
  if (value === null || value === undefined) return ""
  return normaliseWrite(value, props) ?? ""
}

export const pinInputMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    editable: ({ props }) => editable(props),
  },
  actions: {
    applyEdit: (args) => {
      if (args.event.type !== "EDIT") return
      const { edit } = args.event
      apply(args, edit.next, edit.caret, edit.reason === "PASTE")
    },
    callInvalid: ({ event, props }) => {
      if (event.type === "INVALID") props.onValueInvalid?.(event.text)
    },
    applyWrite: (args) => {
      if (args.event.type !== "INPUT") return
      const text =
        args.event.reason === "AUTOFILL"
          ? fillOf(args.values.value, args.event.text, args.props)
          : args.event.text
      const next = normaliseWrite(text, args.props)
      if (next === null) {
        args.props.resync()
        args.props.onValueInvalid?.(args.event.text)
        return
      }
      // A deletion keeps the browser's caret (CARET follows); a fill ends after its text.
      const caret =
        args.event.reason === "AUTOFILL" ? next.length : Math.min(args.context.caret, next.length)
      apply(args, next, caret, args.event.reason === "AUTOFILL")
    },
    /** Read-only and disabled refuse every change, autofill included (base-ui#4805). */
    resync: ({ props }) => props.resync(),
    recordCaret: ({ event, values, set }) => {
      if (event.type === "CARET") set("caret", Math.min(event.index, values.value.length))
    },
    placeCaret: ({ event, values, set, props }) => {
      if (event.type !== "SLOT.PRESS") return
      // A press past the value lands at its end (zag#2999): no holes.
      const caret = Math.min(event.index, values.value.length)
      set("caret", caret)
      props.writeCaret(caret)
    },
    startComposition: ({ event, set }) => {
      if (event.type === "COMPOSITION.START") set("compositionCaret", event.caret)
    },
    commitComposition: (args) => {
      if (args.event.type !== "COMPOSITION.END") return
      const { value } = args.values
      const at = Math.min(args.context.compositionCaret, value.length)
      const plan = planEdit(
        value,
        [at, at],
        { inputType: "insertText", data: args.event.text },
        args.props,
      )
      if (!plan.accept) {
        args.props.resync()
        args.props.onValueInvalid?.(plan.text)
        return
      }
      if (plan.edit) apply(args, plan.edit.next, plan.edit.caret, false)
      else args.props.resync()
    },
    refuseComposition: ({ props }) => props.resync(),
    restoreDefault: ({ props, set }) => {
      const next = renderedValue(props, props.defaultValue)
      set("value", next)
      set("caret", next.length)
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "pin-input",
  initial: "idle",
  context: (props) => {
    const start = renderedValue(props, props.value ?? props.defaultValue)
    return { caret: start.length, compositionCaret: 0, focused: false }
  },
  values: { value: { fallback: "" } },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    // A reset is never a completion (spec "Completion").
    RESET: { actions: ["restoreDefault"] },
  },
  states: {
    idle: {
      on: {
        EDIT: [{ guard: "editable", actions: ["applyEdit"] }, { actions: ["resync"] }],
        INVALID: { actions: ["callInvalid"] },
        INPUT: [{ guard: "editable", actions: ["applyWrite"] }, { actions: ["resync"] }],
        CARET: { actions: ["recordCaret"] },
        "SLOT.PRESS": { actions: ["placeCaret"] },
        "COMPOSITION.START": { target: "composing", actions: ["startComposition"] },
      },
    },
    composing: {
      on: {
        // The IME owns the text until it commits: nothing is filtered or written.
        "COMPOSITION.END": [
          { guard: "editable", target: "idle", actions: ["commitComposition"] },
          { target: "idle", actions: ["refuseComposition"] },
        ],
      },
    },
  },
})
export type PinInputMachine = typeof pinInputMachine
