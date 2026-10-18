// Number Input parts (design §4): the spinbutton input (text always the machine's), the
// triggers (button-like, out of the tab order, aria-disabled at a bound), the hidden number
// input for forms, the insertion plan (`beforeinput`) and the key mapping. Field attributes
// are merged by the caller (`mergeFieldProps`).

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import {
  CRITICAL,
  dataFlag,
  type PartNaming,
  type PartProps,
  scopeAttrs,
} from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import type { LinkEnv } from "../../dom/link"
import type { PlatformFlags } from "../../env/capabilities"
import { keypadDecimal, type LocaleNumberParser } from "../../i18n/number-parser"
import { buttonLikeProps } from "../shared/button-like"
import type { FieldControlProps } from "../shared/field-control"
import type { NumberInputEvent, Trigger } from "./number-input.machine"
import type { NumberInputMessages } from "./number-input.messages"

export type NumberInputPart =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "control"
  | "input"
  | "increment-trigger"
  | "decrement-trigger"
  | "hidden-input"

// ── The insertion plan ──────────────────────────────────────────────────────────────

export interface InsertionInput {
  readonly text: string
  readonly selectionStart: number
  readonly selectionEnd: number
  /** `beforeinput`'s data (the inserted text), null for deletions. */
  readonly data: string | null
  readonly inputType: string
}

export type InsertionPlan =
  | { readonly kind: "accept" }
  | { readonly kind: "reject" }
  /** Apply this text instead (the keypad decimal quirk mapped the character). */
  | { readonly kind: "replace"; readonly text: string; readonly caret: number }

/**
 * Whether an edit may happen (spec "Typing And Commit"): insertions are checked as partial
 * input in the locale; deletions, cuts, undo and redo always pass. Pure.
 */
export function planInsertion(
  e: InsertionInput,
  parser: LocaleNumberParser,
  o: {
    readonly allowNegative: boolean
    /** The device locale when the keypad quirk applies (iOS, Android). */
    readonly keypadLocale?: string | undefined
  },
): InsertionPlan {
  if (!e.inputType.startsWith("insert") || e.data === null) return { kind: "accept" }
  let data = e.data
  if (o.keypadLocale !== undefined) data = keypadDecimal(data, parser, o.keypadLocale)
  const next = e.text.slice(0, e.selectionStart) + data + e.text.slice(e.selectionEnd)
  if (!parser.isPartial(next, { allowNegative: o.allowNegative })) return { kind: "reject" }
  if (data === e.data) return { kind: "accept" }
  return { kind: "replace", text: next, caret: e.selectionStart + data.length }
}

// ── Keys ────────────────────────────────────────────────────────────────────────────

/**
 * The machine event for a key on the input, or null (left to native text editing): arrows
 * up/down step, Shift and PageUp/PageDown take the large step, Home/End only with that
 * bound. Composition and Alt/Ctrl/Meta chords (browser shortcuts) are never handled.
 */
export function numberInputKey(
  k: KeyDescription,
  o: { readonly hasMin: boolean; readonly hasMax: boolean },
): NumberInputEvent | null {
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  const key = (type: "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST") =>
    ({ type, large: k.shift, modality: "keyboard" }) as const
  switch (k.key) {
    case "ArrowUp":
      return key("INCREASE")
    case "ArrowDown":
      return key("DECREASE")
    case "PageUp":
      return key("PAGE_PREV")
    case "PageDown":
      return key("PAGE_NEXT")
    case "Home":
      return o.hasMin ? key("FIRST") : null
    case "End":
      return o.hasMax ? key("LAST") : null
    case "Enter":
      return { type: "COMMIT", source: "enter" }
    default:
      return null
  }
}

/**
 * `inputMode` (spec "Mobile Keyboard"): `decimal` or `numeric` on the server and while
 * hydrating; after mount, iPhone keypads have no minus (`text`), Android's `numeric` has one.
 */
export function inputModeOf(
  o: { readonly fractions: boolean; readonly allowNegative: boolean; readonly mounted: boolean },
  platform: PlatformFlags,
): "decimal" | "numeric" | "text" {
  const base = o.fractions ? "decimal" : "numeric"
  if (!o.mounted || !o.allowNegative) return base
  // platform-convention: iPhone numeric and decimal keypads have no minus key
  if (platform.ios) return "text"
  // platform-convention: Android's numeric keypad has a minus key
  if (platform.android) return "numeric"
  return base
}

// ── Parts ───────────────────────────────────────────────────────────────────────────

export interface NumberInputConnectInput {
  readonly instance: string
  /** Rendered as another component's part: the host's scope and part names (default its own). */
  readonly naming?: PartNaming<NumberInputPart> | undefined
  readonly value: number | null
  readonly text: string
  readonly defaultValue: number | null
  readonly focused: boolean
  readonly modality: Modality
  readonly composing: boolean
  readonly spinning: boolean
  /** The Field binding merged with the control's own props. */
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  readonly ids: {
    readonly input: string
    readonly increment: string
    readonly decrement: string
    readonly hiddenInput: string
  }
  /** The Label's id while rendered (names the triggers after their own text). */
  readonly labelId: string | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  readonly canIncrement: boolean
  readonly canDecrement: boolean
  readonly pressed: { readonly increment: boolean; readonly decrement: boolean }
  readonly parser: LocaleNumberParser
  readonly messages: NumberInputMessages
  /** Quirk `ios-vo-spinbutton-input`: no spinbutton role or value attributes. */
  readonly plainTextbox: boolean
  readonly inputMode: "decimal" | "numeric" | "text"
  readonly form?: string | undefined
  readonly dir?: "ltr" | "rtl" | undefined
}

export function numberInputConnect(input: NumberInputConnectInput, env: LinkEnv) {
  const { field, value } = input
  const naming = input.naming
  const part = (name: NumberInputPart) =>
    naming
      ? scopeAttrs(naming.scope, naming.part(name), input.instance)
      : scopeAttrs("number-input", name, input.instance)
  const fieldState = {
    ...input.fieldData,
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(field.required || field["aria-required"] === "true"),
    "data-invalid": dataFlag(field.invalid),
  }
  const state = {
    ...fieldState,
    ...focusAttrs(input.focused, input.modality),
    "data-spinning": dataFlag(input.spinning),
    "data-composing": dataFlag(input.composing),
  }
  const valueText =
    value === null
      ? input.messages.empty
      : input.messages.valueText({
          value,
          text: input.parser.valueText(value, { step: input.step }),
        })
  const trigger = (t: Trigger): PartProps => {
    const can = t === "increment" ? input.canIncrement : input.canDecrement
    const id = t === "increment" ? input.ids.increment : input.ids.decrement
    const label = t === "increment" ? input.messages.increment : input.messages.decrement
    const off = field.disabled || field.readOnly || !can
    return {
      ...part(`${t}-trigger`),
      ...fieldState,
      // aria-disabled, never native disabled: a native one would drop the press mid-hold and
      // move focus (react-spectrum#2119, reka-ui#2200).
      ...buttonLikeProps(
        { role: "button", tag: "button", disabled: off, focusableWhenDisabled: true },
        env,
      ),
      id,
      tabindex: -1,
      "aria-controls": input.ids.input,
      "aria-label": label,
      // "Increase" then the Label's text.
      "aria-labelledby": input.labelId ? `${id} ${input.labelId}` : undefined,
      "data-pressed": dataFlag(input.pressed[t]),
      "data-disabled": dataFlag(off),
    }
  }
  return {
    valueText,
    root: (): PartProps => ({ ...state, dir: input.dir }),
    control: (): PartProps => ({ ...part("control"), ...state }),
    input: (): PartProps => ({
      ...part("input"),
      ...state,
      id: input.ids.input,
      type: "text",
      ...(input.plainTextbox
        ? {}
        : {
            role: "spinbutton",
            "aria-valuenow": value ?? undefined,
            "aria-valuemin": input.min,
            "aria-valuemax": input.max,
            "aria-valuetext": valueText,
          }),
      value: input.text,
      inputmode: input.inputMode,
      autocomplete: "off",
      autoCorrect: "off",
      spellcheck: "false",
      disabled: field.disabled || undefined,
      readonly: field.readOnly || undefined,
      "aria-required": field.required || field["aria-required"] === "true" ? "true" : undefined,
      "aria-invalid": field["aria-invalid"],
      "aria-describedby": field["aria-describedby"],
      "aria-labelledby": field["aria-labelledby"],
      "aria-errormessage": field["aria-errormessage"],
      [CRITICAL]: input.plainTextbox
        ? ["type"]
        : ["role", "aria-valuenow", "aria-valuetext", "type"],
    }),
    incrementTrigger: () => trigger("increment"),
    decrementTrigger: () => trigger("decrement"),
    /** The native number input: name, constraints, validity and reset. */
    hiddenInput: (): PartProps => ({
      ...part("hidden-input"),
      type: "number",
      id: input.ids.hiddenInput,
      "aria-hidden": "true",
      tabindex: -1,
      name: field.name,
      form: input.form,
      min: input.min,
      max: input.max,
      // Only an explicit step on a `min` base constrains: a commit snaps to an explicit step
      // only, so the default step must not make a typed 1.5 a native stepMismatch.
      step: input.min === undefined || input.step === undefined ? "any" : input.step,
      required: field.required || undefined,
      disabled: field.disabled || undefined,
      defaultValue: input.defaultValue === null ? "" : String(input.defaultValue),
      style: hiddenFormInputStyle,
    }),
  }
}

export type NumberInputApi = ReturnType<typeof numberInputConnect>
