// Clipboard parts (design §4): every aria-* and data-* attribute. The Trigger's name never
// depends on the state ("Copy", then the Label: "Copy API key"); the result is announced, not
// swapped into the name (Zag swaps it, and screen readers do not read a name change).

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { ClipboardCopyState, ClipboardEvent } from "./clipboard.machine"
import type { ClipboardMessages } from "./clipboard.messages"

export type ClipboardPart =
  | "root"
  | "label"
  | "control"
  | "input"
  | "trigger"
  | "indicator"
  | "value-text"

export interface ClipboardConnectInput {
  readonly instance: string
  readonly state: ClipboardCopyState
  readonly value: string
  readonly disabled: boolean
  readonly messages: ClipboardMessages
  readonly ids: { readonly label: string; readonly input: string; readonly trigger: string }
  /** Which optional parts are rendered: no IDREF points at a missing element. */
  readonly rendered: { readonly label: boolean; readonly input: boolean }
}

/** The focus state of a focusable part (Trigger, Input). */
export interface ClipboardFocusInput {
  readonly focused: boolean
  readonly modality: Modality
}

/** The machine event for a native `copy` in the Input: `whole` only for the whole value. */
export function clipboardInputCopy(a: {
  readonly value: string
  readonly selectionStart: number | null
  readonly selectionEnd: number | null
}): ClipboardEvent {
  const whole = a.value !== "" && a.selectionStart === 0 && a.selectionEnd === a.value.length
  return { type: "INPUT.COPY", whole }
}

export function clipboardConnect(input: ClipboardConnectInput, env: LinkEnv) {
  const shared = {
    "data-state": input.state,
    "data-disabled": dataFlag(input.disabled),
  }
  const base = (part: ClipboardPart): PartProps => ({
    ...scopeAttrs("clipboard", part, input.instance),
    ...shared,
  })
  const labelId = input.rendered.label ? input.ids.label : undefined
  return {
    root: (): PartProps => base("root"),
    label: (): PartProps => ({
      ...base("label"),
      id: input.ids.label,
      for: input.rendered.input ? input.ids.input : undefined,
    }),
    control: (): PartProps => base("control"),
    input: (f: ClipboardFocusInput): PartProps => ({
      ...base("input"),
      ...focusAttrs(f.focused, f.modality),
      id: input.ids.input,
      readonly: true,
      value: input.value,
      disabled: input.disabled ? true : undefined,
      "aria-labelledby": labelId,
      spellcheck: "false",
      autocomplete: "off",
      [CRITICAL]: ["readonly"],
    }),
    trigger: (t: ClipboardFocusInput & { readonly tag: string }): PartProps => ({
      ...buttonLikeProps(
        { role: "button", tag: t.tag, disabled: input.disabled, focusableWhenDisabled: false },
        env,
      ),
      ...base("trigger"),
      ...focusAttrs(t.focused, t.modality),
      id: input.ids.trigger,
      "aria-label": input.messages.copy,
      // "Copy" then the Label: "Copy API key" (the trigger's own aria-label comes first).
      "aria-labelledby": labelId ? `${input.ids.trigger} ${labelId}` : undefined,
    }),
    indicator: (): PartProps => ({ ...base("indicator"), "aria-hidden": "true" }),
    valueText: (): PartProps => base("value-text"),
  }
}
