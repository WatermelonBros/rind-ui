// Password Input parts on top of Text Field's (design §2): the input's privacy attributes
// and `type`, the visibility trigger (a toggle button whose name never follows the state)
// and the indicator.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"

export interface PasswordInputConnectInput {
  readonly scope: string
  readonly instance: string
  readonly visible: boolean
  readonly disabled: boolean
  readonly controlId: string
  /** The Field's validation data attributes (`binding.data`). */
  readonly fieldData: Readonly<Record<string, string | undefined>>
  readonly toggleLabel: string
  /** A VisibilityTrigger is mounted: the browser's own reveal control is hidden. */
  readonly customReveal: boolean
  /** The trigger has focus (its `data-focus` / `data-focus-visible`). */
  readonly triggerFocused?: boolean
  readonly modality?: Modality
}

/** The injected rule: one reveal control (Edge draws its own on password inputs). */
export const passwordRevealStyle =
  '[data-scope="password-input"][data-part="input"][data-custom-reveal]::-ms-reveal { display: none }'

export function passwordInputConnect(input: PasswordInputConnectInput) {
  const state = input.visible ? "visible" : "hidden"
  const data = (part: string) => ({
    ...scopeAttrs(input.scope, part, input.instance),
    ...input.fieldData,
    "data-state": state,
    "data-disabled": dataFlag(input.disabled),
  })
  return {
    root: () => ({ "data-state": state }),
    /** Joined to Text Field's input props; `autoComplete` is a default the consumer overrides. */
    input: (): PartProps => ({
      type: input.visible ? "text" : "password",
      autocomplete: "current-password",
      // Revealed text is never sent to spellcheck or autocorrect services.
      autocapitalize: "none",
      autocorrect: "off",
      spellcheck: "false",
      "data-state": state,
      "data-custom-reveal": dataFlag(input.customReveal),
    }),
    trigger: (): PartProps => ({
      ...data("visibility-trigger"),
      // A button takes no aria-invalid: the Field's invalid flag is not a state of the toggle.
      "data-invalid": undefined,
      ...focusAttrs(input.triggerFocused === true, input.modality ?? "keyboard"),
      type: "button",
      "aria-pressed": input.visible ? "true" : "false",
      // Known once the Input has rendered (its id can come from the Field or the consumer).
      "aria-controls": input.controlId || undefined,
      "aria-label": input.toggleLabel,
      disabled: input.disabled || undefined,
    }),
    indicator: (): PartProps => ({ ...data("indicator"), "aria-hidden": "true" }),
  }
}
