import {
  type FieldControlBinding,
  mergeFieldProps,
  type PinInputEvent,
  type PinValidationType,
  pinInputConnect,
  type pinInputMachine,
} from "@rind-ui/core"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import type { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"

type Machine = ReturnType<typeof useMachine<typeof pinInputMachine>>
export type Rules = {
  readonly length: number
  readonly validationType: PinValidationType | undefined
  readonly pattern: RegExp | undefined
  readonly sanitize: ((t: string) => string) | undefined
}

export const pinInputContext = createContext<{
  readonly instance: () => string
  readonly view: () => Machine["view"]
  readonly send: (e: PinInputEvent) => void
  readonly length: () => number
  readonly rules: () => Rules
  readonly mask: () => boolean
  readonly maskChar: () => string
  readonly autoComplete: () => string
  readonly enterKeyHint: () => string | undefined
  readonly form: () => string | undefined
  readonly dir: () => "ltr" | "rtl" | undefined
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly inputEl: { current: HTMLInputElement | null }
  readonly pendingCaret: { current: number | null }
  readonly pendingSubmit: { current: boolean }
  readonly slots: { current: number }
}>("pin-input")
type Ctx = ReturnType<typeof pinInputContext.get>

/** The connect output, with the Field binding merged. Call during initialisation; read in deriveds. */
export function useApi(ctx: Ctx, binding: (() => FieldControlBinding) | null) {
  const env = useEnvironment()
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  return () => {
    const view = ctx.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      { role: "textbox", labelable: true, disabled: ctx.disabled(), readOnly: ctx.readOnly() },
      b,
    )
    return pinInputConnect({
      ...ctx.rules(),
      instance: ctx.instance(),
      value: view.values.value,
      caret: view.context.caret,
      focused: view.context.focused,
      modality: modality.current,
      composing: view.matches("composing"),
      field,
      fieldData: b?.data,
      mask: ctx.mask(),
      maskChar: ctx.maskChar(),
      autoComplete: ctx.autoComplete(),
      enterKeyHint: ctx.enterKeyHint(),
      form: ctx.form(),
      dir: ctx.dir(),
    })
  }
}

export const stateOf = (ctx: Ctx) => ({
  value: ctx.view().values.value,
  complete: ctx.view().values.value.length === ctx.length(),
  composing: ctx.view().matches("composing"),
  focused: ctx.view().context.focused,
})
