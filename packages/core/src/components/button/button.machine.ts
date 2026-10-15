// Button (design §2): `idle` / `pending` bound to the `pending` prop; PRESS guarded so no
// handler order can activate a disabled or pending Button (base-ui#1312).

import type { BlurEvent, FocusEvent, ModifierState, PressEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { AnnouncerEnv } from "../../env/capabilities"
import { bindProp, setup, type } from "../../machine/setup"
import type { ButtonMessages } from "./button.messages"

export type FieldsetChangeEvent = { readonly type: "FIELDSET.CHANGE"; readonly disabled: boolean }
export type ButtonEvent = PressEvent | FocusEvent | BlurEvent | FieldsetChangeEvent

export interface ButtonPressDetails extends ModifierState {
  readonly modality: Modality
}

export interface ButtonProps {
  readonly disabled?: boolean | undefined
  readonly pending?: boolean | undefined
  /** Once per activation (pointer, touch, Enter, Space, a bare click). */
  readonly onPress?: ((details: ButtonPressDetails) => void) | undefined
  readonly onPressStart?: ((details: ButtonPressDetails) => void) | undefined
  /** When a press ends, also when it is cancelled or released outside. */
  readonly onPressEnd?: ((details: ButtonPressDetails) => void) | undefined
  /** Resolved messages (defaults, provider, prop). */
  readonly messages: ButtonMessages
  /** For the pending announcement's key. */
  readonly id: string
}

const details = (e: PressEvent): ButtonPressDetails => ({
  modality: e.modality,
  shiftKey: e.shiftKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  altKey: e.altKey,
})

export const buttonMachine = setup({
  types: type<{
    props: ButtonProps
    events: ButtonEvent
    env: AnnouncerEnv
    context: { focused: boolean; fieldsetDisabled: boolean; pressing: boolean }
  }>(),
  guards: {
    isDisabled: ({ props, context }) => props.disabled === true || context.fieldsetDisabled,
    isPressing: ({ context }) => context.pressing,
  },
  actions: {
    notifyPress: ({ props, event }) => {
      if (event.type === "PRESS") props.onPress?.(details(event))
    },
    notifyPressStart: ({ props, event, set }) => {
      set("pressing", true)
      if (event.type === "PRESS.START") props.onPressStart?.(details(event))
    },
    notifyPressEnd: ({ props, event, set }) => {
      set("pressing", false)
      if (event.type === "PRESS.END" || event.type === "PRESS.CANCEL") {
        props.onPressEnd?.(details(event))
      }
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
    setFieldsetDisabled: ({ set, event }) => {
      if (event.type === "FIELDSET.CHANGE") set("fieldsetDisabled", event.disabled)
    },
    announcePending: ({ context, props, env }) => {
      if (!context.focused) return
      env.announcer.announce({
        message: props.messages.pending,
        priority: "polite",
        key: `button-${props.id}-pending`,
      })
    },
  },
}).machine({
  id: "button",
  initial: "idle",
  context: () => ({ focused: false, fieldsetDisabled: false, pressing: false }),
  values: { pending: bindProp({ fallback: false, states: { pending: true, idle: false } }) },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    "FIELDSET.CHANGE": { actions: ["setFieldsetDisabled"] },
    "PRESS.END": { guard: "isPressing", actions: ["notifyPressEnd"] },
    "PRESS.CANCEL": { guard: "isPressing", actions: ["notifyPressEnd"] },
  },
  states: {
    idle: {
      on: {
        PRESS: { guard: { not: "isDisabled" }, actions: ["notifyPress"] },
        "PRESS.START": { guard: { not: "isDisabled" }, actions: ["notifyPressStart"] },
      },
    },
    pending: { entry: ["announcePending"] },
  },
})

export type ButtonMachine = typeof buttonMachine
