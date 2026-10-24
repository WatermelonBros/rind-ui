import { type CheckedState, checkboxConnect, mergeFieldProps } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { useFieldControl } from "../field/context.svelte"
import { useEnvironment } from "../provider"
import { useRenderedId } from "../use-ids.svelte"
import { useModality } from "../use-modality.svelte"
import type {
  FormToggleConfig,
  FormToggleGrouped,
  FormToggleGrouping,
  FormToggleService,
} from "./types"

export interface FormToggleContext {
  readonly config: FormToggleConfig
  readonly instance: () => string
  readonly service: FormToggleService
  readonly binding: ReturnType<typeof useFieldControl>
  readonly own: () => {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean
    readonly name: string | undefined
  }
  readonly focusableWhenDisabled: () => boolean
  readonly ids: () => { control: string; label: string; description: string; hiddenInput: string }
  readonly registry: PartRegistry<"label" | "description">
  readonly controlEl: { current: Element | null }
  readonly inputEl: { current: HTMLInputElement | null }
  readonly controlTag: () => string
  readonly setControlTag: (tag: string) => void
  readonly hidden: () => { value: string; form: string | undefined; defaultChecked: CheckedState }
  readonly uncheckedValue: () => string | undefined
  /** Driven by a group (an item, or the group's select-all Parent). */
  readonly grouped: () => FormToggleGrouped | null
}

export const formToggleContext = createContext<FormToggleContext>("form-toggle")
/** Provided by CheckboxGroup.Root and its Parent (a getter); only checkboxes read it. */
export const formToggleGrouping =
  createContext<() => FormToggleGrouping | null>("form-toggle-grouping")

export const partName = (
  config: FormToggleConfig,
  part: "Root" | "Control" | "Indicator" | "Label" | "Description",
) => config.partNames?.[part] ?? `${config.label}.${part}`

/** The connect output for a part, with that part's interaction state. Call during initialisation. */
export function useApi(ctx: FormToggleContext) {
  const env = useEnvironment()
  const modality = useModality(env.modality, () => ctx.service.focused())
  const description = useRenderedId(ctx.registry, "description")
  const label = useRenderedId(ctx.registry, "label")
  return (
    extra: {
      pressed?: boolean
      hovered?: boolean
      describedBy?: string | undefined
      ariaLabel?: string | undefined
      ariaLabelledBy?: string | undefined
    } = {},
  ) => {
    const labelable = ctx.controlTag() === "button" || ctx.controlTag() === "input"
    const grouped = ctx.grouped()
    const field = mergeFieldProps(
      {
        role: ctx.config.role,
        labelable,
        ...ctx.own(),
        describedBy: description.current,
        consumerDescribedBy:
          [extra.describedBy, grouped?.props.describedBy].filter(Boolean).join(" ") || undefined,
        ariaLabel: extra.ariaLabel,
        ariaLabelledBy: extra.ariaLabelledBy,
      },
      ctx.binding?.() ?? null,
    )
    const hidden = ctx.hidden()
    return checkboxConnect(
      {
        scope: ctx.config.scope,
        role: ctx.config.role,
        indicatorPart: ctx.config.indicatorPart,
        instance: ctx.instance(),
        checked: ctx.service.checked(),
        tag: ctx.controlTag(),
        labelable,
        field,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        focused: ctx.service.focused(),
        modality: modality.current,
        pressed: extra.pressed ?? false,
        hovered: extra.hovered ?? false,
        ids: ctx.ids(),
        labelRendered: label.current !== undefined,
        fieldData: ctx.binding?.().data,
        value: hidden.value,
        form: hidden.form,
        defaultChecked: hidden.defaultChecked,
        uncheckedValue: ctx.uncheckedValue(),
      },
      env,
    )
  }
}

export const stateOf = (ctx: FormToggleContext, api: ReturnType<ReturnType<typeof useApi>>) => {
  const root = api.root()
  return {
    checked: ctx.service.checked(),
    disabled: root["data-disabled"] !== undefined,
    readOnly: root["data-readonly"] !== undefined,
  }
}
