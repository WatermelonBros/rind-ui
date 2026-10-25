import { Component, Directive, forwardRef, output, ViewEncapsulation } from "@angular/core"
import {
  type ChangeDetails,
  type CheckboxEvent,
  type CheckedState,
  checkboxMachine,
  checkboxMachineProps,
  type FormInputCapability,
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

export type CheckboxState = FormToggleState<CheckedState>

/**
 * A two- or three-state checkbox (APG Checkbox); inside a Checkbox Group, one of its items
 * (`rindCheckboxGroupItem` with a `value`): `<div rindCheckboxRoot name="tos">` with a
 * `<button rindCheckboxControl>`, a Label and a Description; the hidden form input follows the
 * content.
 */
@Component({
  selector: "[rindCheckboxRoot], [rindCheckboxGroupItem]",
  exportAs: "rindCheckboxRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: FORM_TOGGLE, useExisting: forwardRef(() => CheckboxRoot) }],
  template: FORM_TOGGLE_TEMPLATE,
})
export class CheckboxRoot extends FormToggleRoot<CheckedState, ChangeDetails<CheckboxEvent>> {
  /** Every user-caused change (toggle or form reset); `details.cancel()` vetoes it. */
  readonly checkedChangeDetails = output<ChangeEvent<CheckedState, CheckboxEvent>>()
  /** The accepted value, for `[(checked)]`. */
  readonly checkedChange = output<CheckedState>()

  /** @internal */
  readonly config = {
    scope: "checkbox",
    role: "checkbox",
    indicatorPart: "indicator",
    root: "rindCheckboxRoot",
  } as const

  protected createService(
    props: () => FormToggleServiceProps<CheckedState, ChangeDetails<CheckboxEvent>>,
    formInput: FormInputCapability,
  ): FormToggleService {
    const { view, send } = injectMachine(
      checkboxMachine,
      () => checkboxMachineProps(props(), formInput),
      { formInput },
    )
    return {
      checked: () => view().values.checked ?? false,
      focused: () => view().context.focused,
      send,
    }
  }

  protected emitChange(checked: CheckedState, details: ChangeDetails<CheckboxEvent>): boolean {
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

/** The checkable control: `<button rindCheckboxControl>`. */
@Directive({
  selector: "[rindCheckboxControl], [rindCheckboxGroupItemControl]",
  exportAs: "rindCheckboxControl",
})
export class CheckboxControl extends FormToggleControl {}

/** Decorative: follows the checked state (`data-state` checked / unchecked / indeterminate). */
@Directive({
  selector: "[rindCheckboxIndicator], [rindCheckboxGroupItemIndicator]",
  exportAs: "rindCheckboxIndicator",
})
export class CheckboxIndicator extends FormToggleIndicator {}

@Directive({
  selector: "[rindCheckboxLabel], [rindCheckboxGroupItemLabel]",
  exportAs: "rindCheckboxLabel",
})
export class CheckboxLabel extends FormToggleLabel {}

@Directive({
  selector: "[rindCheckboxDescription], [rindCheckboxGroupItemDescription]",
  exportAs: "rindCheckboxDescription",
})
export class CheckboxDescription extends FormToggleDescription {}

/** The Checkbox's parts, for a standalone component's `imports`. */
export const Checkbox = [
  CheckboxRoot,
  CheckboxControl,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxDescription,
] as const
