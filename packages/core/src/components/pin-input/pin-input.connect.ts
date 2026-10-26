// Pin Input parts (design §4): one transparent input over aria-hidden slots. Connect owns
// every attribute; the adapter wires the native listeners (beforeinput, input, composition,
// selectionchange, pointerdown) to the machine.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { FieldControlProps } from "../shared/field-control"
import type { PinRules } from "./edit-plan"

export interface PinInputConnectInput extends PinRules {
  readonly instance: string
  readonly value: string
  readonly caret: number
  readonly focused: boolean
  readonly modality: Modality
  readonly composing: boolean
  /** The Field binding merged with the control's own props. */
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<string, string | undefined>> | undefined
  readonly mask: boolean
  readonly maskChar: string
  readonly autoComplete: string
  readonly enterKeyHint?: string | undefined
  readonly form?: string | undefined
  /** The consumer's `dir`; the code itself is always laid out left to right. */
  readonly dir?: "ltr" | "rtl" | undefined
}

/** The injected rules: only the slots are visible (selection and autofill paint included). */
export const pinInputStyle = [
  '[data-scope="pin-input"][data-part="input"]::selection { background: transparent; color: transparent }',
  '[data-scope="pin-input"][data-part="input"]:autofill { -webkit-text-fill-color: transparent; box-shadow: 0 0 0 1000px transparent inset; background: transparent }',
  '[data-scope="pin-input"][data-part="input"]:-webkit-autofill { -webkit-text-fill-color: transparent; box-shadow: 0 0 0 1000px transparent inset; transition: background-color 99999s }',
].join("\n")

const OVERLAY = {
  position: "absolute",
  inset: "0",
  width: "100%",
  height: "100%",
  margin: "0",
  padding: "0",
  border: "0",
  outline: "0",
  background: "transparent",
  color: "transparent",
  "caret-color": "transparent",
  "font-size": "16px",
  "letter-spacing": "0",
  "text-indent": "0",
  // The text never paints, but it must not scroll or wrap away from the caret.
  "white-space": "nowrap",
} as const

/**
 * An anchored pattern requiring exactly `length` accepted characters. A consumer's RegExp is
 * not reused: its flags would be dropped and HTML compiles `pattern` with `v` and implicit
 * anchors (`/[a-f]/i`, `/^[A-Z]$/`, `/[\w-]/` would all disagree with what is accepted).
 * Every character already passed it, so only the count is checked.
 */
export function codePattern(rules: PinRules): string {
  const one = rules.pattern
    ? "[\\s\\S]"
    : { numeric: "[0-9]", alphanumeric: "[A-Za-z0-9]", alpha: "[A-Za-z]" }[
        rules.validationType ?? "numeric"
      ]
  return `(?:${one}){${rules.length}}`
}

/** The slot at the caret, or the last one when the code is full. */
export const activeSlot = (value: string, caret: number, length: number) =>
  Math.min(Math.min(caret, value.length), length - 1)

export function pinInputConnect(input: PinInputConnectInput) {
  const { field, value, length } = input
  const complete = value.length === length
  const active = activeSlot(value, input.caret, length)
  const fieldState = {
    ...input.fieldData,
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-invalid": dataFlag(field.invalid),
  }
  const stateful = (part: string) => ({
    ...scopeAttrs("pin-input", part, input.instance),
    ...fieldState,
    ...focusAttrs(input.focused, input.modality),
    "data-complete": dataFlag(complete),
    "data-composing": dataFlag(input.composing),
  })
  const uppercases = input.sanitize !== undefined && input.sanitize("a") === "A"
  return {
    complete,
    active,
    root: (): PartProps => ({ ...stateful("root"), dir: input.dir ?? "ltr" }),
    control: (): PartProps => ({
      ...stateful("control"),
      dir: input.dir ?? "ltr",
      style: { position: "relative" },
    }),
    input: (): PartProps => ({
      ...stateful("input"),
      type: input.mask ? "password" : "text",
      name: field.name,
      form: input.form,
      // Uncontrolled in the framework sense: a re-render must never rewrite the text while
      // an IME composes (it cancels the composition); the adapter syncs it between them.
      defaultValue: value,
      autocomplete: input.autoComplete,
      inputmode:
        (input.validationType ?? "numeric") === "numeric" && !input.pattern ? "numeric" : "text",
      maxlength: length,
      pattern: codePattern(input),
      autocapitalize: uppercases ? "characters" : "none",
      autocorrect: "off",
      spellcheck: "false",
      enterkeyhint: input.enterKeyHint,
      dir: input.dir ?? "ltr",
      disabled: field.disabled || undefined,
      readonly: field.readOnly || undefined,
      required: field.required || undefined,
      "aria-required": field["aria-required"],
      "aria-invalid": field["aria-invalid"],
      "aria-describedby": field["aria-describedby"],
      "aria-labelledby": field["aria-labelledby"],
      "aria-errormessage": field["aria-errormessage"],
      style: OVERLAY,
    }),
    slot: (index: number): PartProps => {
      const char = value[index]
      const isActive = input.focused && index === active
      return {
        ...scopeAttrs("pin-input", "slot", input.instance),
        ...fieldState,
        "aria-hidden": "true",
        "data-index": String(index),
        "data-filled": dataFlag(char !== undefined),
        "data-active": dataFlag(isActive),
        "data-caret": dataFlag(isActive && char === undefined),
        "data-masked": dataFlag(input.mask && char !== undefined),
        // Slots never take a press: the input above them does.
        style: { "pointer-events": "none" },
        children: char === undefined ? null : input.mask ? input.maskChar : char,
      }
    },
  }
}
