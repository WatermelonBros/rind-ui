// Toggle's parts: the button-like rules plus `aria-pressed` (always explicit, critical)
// and `data-state`. `data-pressed` keeps its meaning: a press in progress, never "on".

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"

declare const process: { env: { NODE_ENV?: string } }

export interface ToggleConnectState {
  readonly instance: string
  readonly tag: string
  readonly on: boolean
  /** The prop, or a disabled fieldset around it. */
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly focused: boolean
  readonly modality: Modality
  /** A press in progress. */
  readonly pressed: boolean
  readonly hovered: boolean
}

export function toggleConnect(state: ToggleConnectState, env: LinkEnv) {
  const dataState = state.on ? "on" : "off"
  return {
    root: (): PartProps => ({
      ...scopeAttrs("toggle", "root", state.instance),
      ...buttonLikeProps(
        {
          role: "button",
          tag: state.tag,
          disabled: state.disabled,
          focusableWhenDisabled: state.focusableWhenDisabled,
          type: "button",
        },
        env,
      ),
      "aria-pressed": String(state.on),
      "data-state": dataState,
      "data-disabled": dataFlag(state.disabled),
      ...focusAttrs(state.focused, state.modality),
      "data-pressed": dataFlag(state.pressed),
      "data-hover": dataFlag(state.hovered),
      [CRITICAL]: ["aria-pressed"],
    }),
    indicator: (): PartProps => ({
      ...scopeAttrs("toggle", "indicator", state.instance),
      "aria-hidden": "true",
      "data-state": dataState,
      "data-disabled": dataFlag(state.disabled),
    }),
  }
}

/**
 * Development: the accessible name must not follow the state (APG Button). Returns the
 * name to compare against next time; warns when it changed across a state change.
 */
export function checkStableName(
  previous: { readonly name: string; readonly on: boolean } | undefined,
  current: { readonly name: string; readonly on: boolean },
): void {
  if (process.env.NODE_ENV === "production" || !previous) return
  if (previous.on !== current.on && previous.name !== current.name) {
    console.warn(
      `[rind-ui] toggle: the accessible name changed with the state ("${previous.name}" → "${current.name}"); keep one name and let aria-pressed convey the state`,
    )
  }
}
