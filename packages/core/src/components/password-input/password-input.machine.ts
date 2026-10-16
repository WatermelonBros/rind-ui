// Password Input (design §1): a Text Field preset with one more controllable, `visible`.
// Not state-bound: no transition depends on it, so the graph stays Text Field's. The
// adapter watches the form (submit always, reset unless prevented) and restores the
// selection after the input's `type` changes; the machine decides.

import type { Modality } from "../../contract/env"
import { buildTextFieldMachine } from "../text-field/text-field.machine"
import type { PasswordInputMessages } from "./password-input.messages"

export type PasswordInputHideReason = "SUBMIT" | "RESET"

export type PasswordInputEvent =
  | {
      readonly type: "VISIBILITY.TOGGLE"
      readonly modality: Modality
      /** Focus is in the input (a pointer press that kept it there): announce the change. */
      readonly inputFocused: boolean
      /** The input's selection when the press started, restored after the `type` change. */
      readonly selection: readonly [number, number] | null
    }
  | { readonly type: "VISIBILITY.HIDE"; readonly reason: PasswordInputHideReason }

export interface PasswordInputOwnProps {
  readonly visible?: boolean | undefined
  readonly defaultVisible?: boolean | undefined
  /** Translated by the adapter into `(visible, { reason: "PRESS" | "SUBMIT" | "RESET" })`. */
  readonly onVisibleChange?: ((visible: boolean, details: unknown) => void) | undefined
  readonly messages: PasswordInputMessages
  /** Watches the input's form; returns the cleanup. Submit always hides, reset unless prevented. */
  readonly watchForm?:
    | ((on: { readonly submit: () => void; readonly reset: () => void }) => () => void)
    | undefined
  /** Restores the input's selection once the new `type` is rendered (same frame). */
  readonly keepSelection?: ((selection: readonly [number, number]) => void) | undefined
}

export const { machine: passwordInputMachine } = buildTextFieldMachine<{
  props: PasswordInputOwnProps
  events: PasswordInputEvent
  values: "visible"
}>({
  scope: "password-input",
  values: { visible: { fallback: false } },
  events: {
    // Read-only allows it (nothing about the value changes); disabled refuses.
    "VISIBILITY.TOGGLE": { guard: "notDisabled", actions: ["toggleVisible"] },
    "VISIBILITY.HIDE": { actions: ["hide"] },
  },
  guards: {
    notDisabled: ({ props }) => !props.disabled && !props.focusableWhenDisabled,
  },
  actions: {
    toggleVisible: ({ event, values, props, env, set }) => {
      if (event.type !== "VISIBILITY.TOGGLE") return
      const next = !values.visible
      set("visible", next)
      if (event.selection) props.keepSelection?.(event.selection)
      // A focused trigger speaks its pressed state; only focus in the input needs words.
      if (event.inputFocused) {
        env.announcer.announce({
          message: props.messages.visibilityAnnouncement(next),
          priority: "polite",
          key: `password-input-${props.id}-visibility`,
        })
      }
    },
    hide: ({ values, set }) => {
      if (values.visible) set("visible", false)
    },
  },
  effects: {
    // Live props (radix#4157): the hide is proposed through whatever is current at the event.
    formVisibilityReset: ({ props, send }) =>
      props.watchForm?.({
        submit: () => send({ type: "VISIBILITY.HIDE", reason: "SUBMIT" }),
        reset: () => send({ type: "VISIBILITY.HIDE", reason: "RESET" }),
      }),
  },
  serviceEffects: ["formVisibilityReset"],
})
export type PasswordInputMachine = typeof passwordInputMachine
