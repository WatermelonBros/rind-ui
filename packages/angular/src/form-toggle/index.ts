// The parts every form toggle shares (Checkbox, Switch), for a component of the same kind:
// subclass each base as a directive (the Root as a component with FORM_TOGGLE_TEMPLATE),
// provide the Root under FORM_TOGGLE and implement its `createService`.
export {
  FORM_TOGGLE,
  FORM_TOGGLE_TEMPLATE,
  type FormToggleConfig,
  FormToggleControl,
  FormToggleDescription,
  type FormToggleEvent,
  FormToggleIndicator,
  FormToggleLabel,
  FormToggleRoot,
  type FormToggleService,
  type FormToggleServiceProps,
  type FormToggleState,
} from "./form-toggle"
