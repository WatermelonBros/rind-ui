// Button's one part: the button-like rules, plus pending (aria-disabled, never native
// `disabled`, so focus stays) and the state attributes.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import type { Href, RouterOptions } from "../../env/router"
import { buttonLikeProps } from "../shared/button-like"

export interface ButtonConnectState {
  readonly instance: string
  readonly tag: string
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly origin?: string | undefined
  /** The prop, or a disabled fieldset around it. */
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly pending: boolean
  readonly type?: "button" | "submit" | "reset" | undefined
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
}

export function buttonConnect(state: ButtonConnectState, env: LinkEnv): PartProps {
  const { disabled, pending } = state
  const own = buttonLikeProps(
    {
      role: "button",
      tag: state.tag,
      href: state.href,
      routerOptions: state.routerOptions,
      origin: state.origin,
      // Pending is disabled for activation but keeps focus: aria-disabled, never native.
      disabled: disabled || pending,
      focusableWhenDisabled: state.focusableWhenDisabled || (pending && !disabled),
      // A pending submit stays the form's default button: as "button", Enter in a field
      // would submit through another button, or alone (RA#7543). Its click is cancelled below.
      type: state.type,
    },
    env,
  )
  return {
    ...scopeAttrs("button", "root", state.instance),
    ...own,
    // Pending is aria-disabled, so it is data-disabled too (button-like-element).
    "data-disabled": dataFlag(disabled || pending),
    "data-state": pending ? "pending" : "idle",
    "data-pending": dataFlag(pending),
    ...focusAttrs(state.focused, state.modality),
    "data-pressed": dataFlag(state.pressed),
    "data-hover": dataFlag(state.hovered),
    // Pending: its own press and implicit submission (a synthetic click on the default
    // button) are cancelled, so the form is not submitted again.
    ...(pending
      ? {
          onClick: (e: unknown) => {
            ;(e as Event).preventDefault()
          },
        }
      : {}),
  }
}
