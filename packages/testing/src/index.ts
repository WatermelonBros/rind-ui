// Drivers, adapters and model-based tests built on component contracts.

export { platforms, withEngine } from "@rind-ui/core"
export {
  type AccordionStepInvariants,
  accordionStepInvariants,
} from "./accordion-invariants"
export type { AdapterEnv, Direction, EnvFactory, EnvOptions } from "./adapter"
export { type DomAdapterOptions, domEnv, type UserLike } from "./adapters/dom"
export {
  type PlaywrightAdapterOptions,
  type PlaywrightTarget,
  playwrightEnv,
} from "./adapters/playwright"
export { installAnnouncementLog, recordingAnnouncer } from "./announcements"
export { missingAriaLines } from "./aria-snapshot"
export { type CheckboxStepInvariants, checkboxStepInvariants } from "./checkbox-invariants"
export type { DomSnapshot, ElementInfo, IdRef } from "./collect"
export { getAccordion } from "./components/accordion"
export { getAlertDialog } from "./components/alert-dialog"
export { getButton } from "./components/button"
export { getCheckbox } from "./components/checkbox"
export { getCheckboxGroup } from "./components/checkbox-group"
export { getCollapsible } from "./components/collapsible"
export { getDialog } from "./components/dialog"
export { getField } from "./components/field"
export { getFieldset } from "./components/fieldset"
export { getForm } from "./components/form"
export { getHeading } from "./components/heading"
export { getLabel } from "./components/label"
export { getLink } from "./components/link"
export { getNumberInput } from "./components/number-input"
export { getPasswordInput } from "./components/password-input"
export { getPopover } from "./components/popover"
export { getRadioGroup } from "./components/radio-group"
export { getSearchField } from "./components/search-field"
export { getSegmentedControl } from "./components/segmented-control"
export { getSeparator } from "./components/separator"
export { getSlider } from "./components/slider"
export { getSwitch } from "./components/switch"
export { getTabs } from "./components/tabs"
export { getTextField } from "./components/text-field"
export { getToggle } from "./components/toggle"
export { getToggleGroup } from "./components/toggle-group"
export { getToolbar } from "./components/toolbar"
export { getTooltip } from "./components/tooltip"
export {
  type FakeDelayGroup,
  type FakeHoverIntent,
  fakeDelayGroup,
  fakeHoverIntent,
} from "./delay-group"
export {
  type ContractModality,
  createDriver,
  createDriverWith,
  type Driver,
  type DriverOptions,
  runAction,
  type Target,
} from "./driver"
export { type FormStepInvariants, formStepInvariants } from "./form-invariants"
export {
  type GraphEdge,
  type GraphNode,
  type MachineGraph,
  type Path,
  paths,
  toGraph,
  uncovered,
} from "./graph"
export {
  checkGeneric,
  genericInvariants,
  layoutInvariant,
  type StepFacts,
  traitInvariants,
} from "./invariants"
export {
  type ConsumerInvariant,
  currentRun,
  type MachinePath,
  machinePaths,
  type RunContext,
  type TestMachineOptions,
  testMachine,
} from "./model"
export {
  type FakeRouter,
  type FakeRouterCall,
  fakeRouter,
  interceptNativeNavigation,
  type Navigation,
  navigationLog,
} from "./navigation"
export {
  type NumberInputStepInvariants,
  numberInputStepInvariants,
} from "./number-input-invariants"
export { type FakePositioning, fakePositioning } from "./positioning"
export { englishLeaks, pseudo, pseudoMessages } from "./pseudo-locale"
export {
  type SearchFieldStepInvariants,
  searchFieldStepInvariants,
} from "./search-field-invariants"
export { type SliderStepInvariants, sliderStepInvariants } from "./slider-invariants"
export { missingStateStories, type StateStories } from "./state-stories"
export { type SwitchStepInvariants, switchStepInvariants } from "./switch-invariants"
export { type TextFieldStepInvariants, textFieldStepInvariants } from "./text-field-invariants"
export { liveAnnouncements, spokenLog } from "./virtual-sr"
