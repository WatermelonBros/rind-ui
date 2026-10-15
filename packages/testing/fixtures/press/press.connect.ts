import {
  CRITICAL,
  focusAttrs,
  type Modality,
  type PartProps,
  partId,
  scopeAttrs,
} from "@rind-ui/core"

export interface PressPartState {
  readonly focused: boolean
  readonly modality: Modality
  /** A press is in progress and the pointer is over the part. */
  readonly pressing: boolean
  readonly disabled: boolean
}

/** Toggle state → the button's neutral props (press handlers are added by the part). */
export function connectToggle(
  state: PressPartState & { readonly on: boolean },
  root: string,
): PartProps {
  return {
    ...scopeAttrs("toggle", "root", root),
    id: partId("toggle", root, "root"),
    type: "button",
    "aria-pressed": String(state.on),
    "aria-disabled": state.disabled ? "true" : undefined,
    "data-disabled": state.disabled ? "" : undefined,
    "data-state": state.on ? "on" : "off",
    "data-pressed": state.pressing ? "" : undefined,
    ...focusAttrs(state.focused, state.modality),
    [CRITICAL]: ["aria-pressed"],
  }
}

/** Counter state → the button's neutral props. */
export function connectCounter(
  state: PressPartState & { readonly count: number },
  root: string,
): PartProps {
  return {
    ...scopeAttrs("counter", "root", root),
    id: partId("counter", root, "root"),
    type: "button",
    "aria-disabled": state.disabled ? "true" : undefined,
    "data-disabled": state.disabled ? "" : undefined,
    "data-count": String(state.count),
    "data-pressed": state.pressing ? "" : undefined,
    ...focusAttrs(state.focused, state.modality),
  }
}
