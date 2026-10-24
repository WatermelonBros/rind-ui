import { Component, Directive, forwardRef, output, ViewEncapsulation } from "@angular/core"
import {
  type ChangeDetails,
  type FormInputCapability,
  type SwitchEvent,
  switchMachine,
  switchMachineProps,
} from "@rind-ui/core"
import type { ChangeEvent } from "../emit-change"
import {
  FORM_TOGGLE,
  FORM_TOGGLE_TEMPLATE,
  FormToggleControl,
  FormToggleDescription,
  FormToggleIndicator,
  FormToggleLabel,
  FormToggleRoot,
  type FormToggleService,
  type FormToggleServiceProps,
  type FormToggleState,
} from "../form-toggle/form-toggle"
import { injectMachine } from "../inject-machine"
import { RindProps } from "../rind-props"

export type SwitchState = FormToggleState<boolean>

/**
 * An on/off switch (APG Switch): `<div rindSwitchRoot name="wifi">` with a
 * `<button rindSwitchControl>` holding the Thumb, and a Label; the hidden form input follows the
 * content.
 */
@Component({
  selector: "[rindSwitchRoot]",
  exportAs: "rindSwitchRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: FORM_TOGGLE, useExisting: forwardRef(() => SwitchRoot) }],
  template: FORM_TOGGLE_TEMPLATE,
})
export class SwitchRoot extends FormToggleRoot<boolean, ChangeDetails<SwitchEvent>> {
  /** Every user-caused change (toggle or form reset); `details.cancel()` vetoes it. */
  readonly checkedChangeDetails = output<ChangeEvent<boolean, SwitchEvent>>()
  /** The accepted value, for `[(checked)]`. */
  readonly checkedChange = output<boolean>()

  /** @internal */
  readonly config = {
    scope: "switch",
    role: "switch",
    indicatorPart: "thumb",
    root: "rindSwitchRoot",
  } as const

  protected createService(
    props: () => FormToggleServiceProps<boolean, ChangeDetails<SwitchEvent>>,
    formInput: FormInputCapability,
  ): FormToggleService {
    const { view, send } = injectMachine(
      switchMachine,
      () => switchMachineProps(props(), formInput),
      { formInput },
    )
    return {
      checked: () => view().values.checked === true,
      focused: () => view().context.focused,
      send,
    }
  }

  protected emitChange(checked: boolean, details: ChangeDetails<SwitchEvent>): boolean {
    let cancelled = false
    this.checkedChangeDetails.emit({
      value: checked,
      details: {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      },
    })
    if (!cancelled) this.checkedChange.emit(checked)
    return cancelled
  }
}

/** The switch: `<button rindSwitchControl>`. */
@Directive({ selector: "[rindSwitchControl]", exportAs: "rindSwitchControl" })
export class SwitchControl extends FormToggleControl {}

/** The moving part: follows the checked state (`data-state`). */
@Directive({ selector: "[rindSwitchThumb]", exportAs: "rindSwitchThumb" })
export class SwitchThumb extends FormToggleIndicator {}

@Directive({ selector: "[rindSwitchLabel]", exportAs: "rindSwitchLabel" })
export class SwitchLabel extends FormToggleLabel {}

@Directive({ selector: "[rindSwitchDescription]", exportAs: "rindSwitchDescription" })
export class SwitchDescription extends FormToggleDescription {}

/** The Switch's parts, for a standalone component's `imports`. */
export const Switch = [
  SwitchRoot,
  SwitchControl,
  SwitchThumb,
  SwitchLabel,
  SwitchDescription,
] as const
