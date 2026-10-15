// The Fieldset has no machine: `disabled` and `invalid` are props (fieldset design, Goals).

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"

declare const process: { env: { NODE_ENV?: string } }

export type FieldsetPart = "root" | "legend" | "description" | "error-message"

export interface FieldsetConnectState {
  readonly instance: string
  /** Effective: own prop or an enclosing Fieldset's. */
  readonly disabled: boolean
  readonly invalid: boolean
  /** The root's rendered tag. */
  readonly rootTag: string
  /** The Legend is a `<legend>` and the root's first element child (native naming). */
  readonly nativeLegend: boolean
  /** Ids the root's relations may use now (registered parts only). */
  readonly ids: { readonly [P in FieldsetPart]?: string | undefined }
  /** Consumer `aria-describedby`, kept after the parts'. */
  readonly describedBy?: string | undefined
}

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

const warned = new Set<string>()

export function fieldsetConnect(state: FieldsetConnectState) {
  const native = state.rootTag === "fieldset"
  const common = (part: FieldsetPart) => ({
    ...scopeAttrs("fieldset", part, state.instance),
    "data-disabled": dataFlag(state.disabled),
    "data-invalid": dataFlag(state.invalid),
  })
  return {
    root: (): PartProps => {
      if (
        process.env.NODE_ENV !== "production" &&
        !native &&
        state.disabled &&
        !warned.has(state.instance)
      ) {
        warned.add(state.instance)
        console.warn(
          `[rind-ui] fieldset: rendered as <${state.rootTag}>, it does not disable native controls; only rind-ui controls follow its disabled state`,
        )
      }
      return {
        ...common("root"),
        role: native ? undefined : "group",
        disabled: native && state.disabled ? true : undefined,
        "aria-disabled": !native && state.disabled ? "true" : undefined,
        "aria-labelledby": native && state.nativeLegend ? undefined : state.ids.legend,
        // Never an empty string (ark#3707).
        "aria-describedby": join(
          state.ids.description,
          state.invalid ? state.ids["error-message"] : undefined,
          state.describedBy,
        ),
      }
    },
    /** `id`: the part's own (the consumer's, or `partId`). */
    legend: (id: string): PartProps => ({ ...common("legend"), id }),
    description: (id: string): PartProps => ({ ...common("description"), id }),
    errorMessage: (id: string): PartProps => ({ ...common("error-message"), id }),
  }
}
