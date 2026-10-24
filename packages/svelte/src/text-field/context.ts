import type {
  TextFieldMessages,
  TextFieldOwnEvent,
  TextFieldReason,
  textFieldMachine,
} from "@rind-ui/core"
import { textFieldKeysConnect, textFieldVisibilityConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { useMachine } from "../use-machine.svelte"

type Machine = ReturnType<typeof useMachine<typeof textFieldMachine>>

export interface CountState {
  readonly id: string
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

/** The host's state, read by the parts. */
export interface TextFieldHostContext {
  readonly own: () => { readonly type?: string | undefined }
  readonly mounted: () => { readonly clearTriggers: number; readonly triggers: number }
  readonly setMounted: (part: "clearTriggers" | "triggers", delta: 1 | -1) => void
  readonly scope: string
  readonly instance: () => string
  readonly view: () => Machine["view"]
  readonly send: Machine["send"]
  readonly controlled: () => boolean
  readonly defaultValue: () => string | undefined
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly messages: () => TextFieldMessages
  readonly limit: () => number | undefined
  readonly count: () => ((value: string) => number) | undefined
  readonly countId: () => string | undefined
  readonly applySoftLimit: (value: string) => void
  readonly setCount: (state: CountState | null) => void
  readonly setMaxLength: (n: number | undefined) => void
  readonly controlEl: { current: HTMLInputElement | HTMLTextAreaElement | null }
  readonly controlId: () => string | undefined
  readonly setControlId: (id: string | undefined) => void
  readonly pendingSelection: { current: readonly [number, number] | null }
  readonly takeReason: () => TextFieldReason | undefined
  readonly controls: { current: number }
}

export const textFieldContext = createContext<TextFieldHostContext>("text-field")

export function keys(ctx: TextFieldHostContext) {
  return textFieldKeysConnect(
    {
      value: ctx.view().values.value ?? "",
      composing: ctx.view().state === "composing",
      search: ctx.own().type === "search",
      customClear: ctx.mounted().clearTriggers > 0,
    },
    // Sound: the Text Field machine accepts ESCAPE and SUBMIT (its key preset).
    ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  )
}

export const isPassword = (ctx: TextFieldHostContext) => ctx.own().type === "password"

/** The host's view of visibility: the machine's `visible` and the visibility events. */
export function visibilityOf(ctx: TextFieldHostContext) {
  return {
    // Sound: the Text Field machine has the `visible` value (its visibility preset).
    visible: (ctx.view().values as unknown as { readonly visible: boolean }).visible,
    // Sound: the same service accepts the preset's events (merged by name at runtime).
    send: ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  }
}

export function connectInput(ctx: TextFieldHostContext) {
  return {
    scope: ctx.scope,
    instance: ctx.instance(),
    visible: visibilityOf(ctx).visible,
    disabled: ctx.disabled() || ctx.focusableWhenDisabled(),
    controlId: ctx.controlId() ?? "",
    fieldData: {},
    toggleLabel: ctx.messages().toggleLabel,
    customReveal: ctx.mounted().triggers > 0,
  }
}

export const visibilityRootData = (ctx: TextFieldHostContext) =>
  isPassword(ctx) ? textFieldVisibilityConnect(connectInput(ctx)).root() : {}

export const visibilityInputProps = (ctx: TextFieldHostContext) =>
  isPassword(ctx) ? textFieldVisibilityConnect(connectInput(ctx)).input() : {}
