import {
  canStepNumber,
  type FieldControlBinding,
  inputModeOf,
  mergeFieldProps,
  numberInputConnect,
  quirkActive,
} from "@rind-ui/core"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { type numberInputContext, numberInputNaming } from "./context"

type Ctx = ReturnType<typeof numberInputContext.get>

/** The api of a part, with the Field binding merged. Call during initialisation; read in deriveds. */
export function useApi(ctx: Ctx, binding: (() => FieldControlBinding) | null) {
  const env = useEnvironment()
  const naming = numberInputNaming.maybe() ?? null
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  return () => {
    const view = ctx.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      { role: "spinbutton", labelable: true, disabled: ctx.disabled(), readOnly: ctx.readOnly() },
      b,
    )
    const value = view.values.value ?? null
    const parser = ctx.parser()
    const range = { min: ctx.min(), max: ctx.max(), step: ctx.step() }
    return numberInputConnect(
      {
        instance: ctx.instance(),
        ...(naming ? { naming } : {}),
        value,
        text: view.context.text,
        defaultValue: ctx.defaultValue(),
        focused: view.context.focused,
        modality: modality.current,
        composing: view.matches("composing"),
        spinning: view.matches("spinning"),
        field,
        fieldData: b?.data,
        ids: ctx.ids(),
        labelId: b?.ids.label,
        ...range,
        canIncrement: canStepNumber(value, 1, range),
        canDecrement: canStepNumber(value, -1, range),
        pressed: ctx.pressed(),
        parser,
        messages: ctx.messages(),
        plainTextbox: quirkActive("ios-vo-spinbutton-input", env),
        inputMode: inputModeOf(
          {
            fractions: parser.allowsFraction || (range.step !== undefined && range.step % 1 !== 0),
            allowNegative: range.min === undefined || range.min < 0,
            mounted: ctx.mounted(),
          },
          env.platform,
        ),
        form: ctx.form(),
        dir: ctx.dir(),
      },
      env,
    )
  }
}

export const stateOf = (ctx: Ctx) => ({
  value: ctx.view().values.value ?? null,
  text: ctx.view().context.text,
  spinning: ctx.view().matches("spinning"),
  composing: ctx.view().matches("composing"),
  disabled: ctx.disabled(),
  readOnly: ctx.readOnly(),
})
