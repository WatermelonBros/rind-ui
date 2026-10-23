import type { ButtonMessages, ButtonPressDetails, MessageOverrides } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    button: ButtonMessages
  }
}

export interface ButtonState {
  readonly pending: boolean
  readonly disabled: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

export type ButtonProps = Omit<HTMLButtonAttributes, "type" | "disabled" | "children"> & {
  /** Default "button": never submits a form by accident. */
  readonly type?: "button" | "submit" | "reset" | undefined
  /** Ignores activation: native `disabled` on a `<button>`, `aria-disabled` elsewhere. */
  readonly disabled?: boolean | undefined
  /** Keeps a disabled Button in the Tab order (`aria-disabled` instead of `disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Ignores activation, keeps focus, announces `messages.pending` when focused. */
  readonly pending?: boolean | undefined
  /** `false`: a press activates without moving focus. */
  readonly focusOnPress?: boolean | undefined
  /** A link: renders `<a>` (or your `child` element) with link semantics, routed like a Link. */
  readonly href?: string | undefined
  /** Once per activation, with `modality` and the modifier keys. */
  readonly onPress?: ((details: ButtonPressDetails) => void) | undefined
  /** A press starts. */
  readonly onPressStart?: ((details: ButtonPressDetails) => void) | undefined
  /** A press ends, also when cancelled or released outside. */
  readonly onPressEnd?: ((details: ButtonPressDetails) => void) | undefined
  /** Overrides the announced texts. Default: `pending: "Loading"`. */
  readonly messages?: MessageOverrides<ButtonMessages> | undefined
  /** Renders your own element: spread `props` on it. */
  readonly child?: Snippet<[ChildArgs<ButtonState>]> | undefined
  readonly children?: Snippet<[ButtonState]> | undefined
}
