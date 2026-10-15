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
export { getButton } from "./components/button"
export { getCheckbox } from "./components/checkbox"
export { getCheckboxGroup } from "./components/checkbox-group"
export { getCollapsible } from "./components/collapsible"
export { getField } from "./components/field"
export { getFieldset } from "./components/fieldset"
export { getForm } from "./components/form"
export { getHeading } from "./components/heading"
export { getLabel } from "./components/label"
export { getLink } from "./components/link"
export { getRadioGroup } from "./components/radio-group"
export { getSegmentedControl } from "./components/segmented-control"
export { getSwitch } from "./components/switch"
export { getTabs } from "./components/tabs"
export { getTextField } from "./components/text-field"
export { getToggle } from "./components/toggle"
export { getToggleGroup } from "./components/toggle-group"
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
export { type FakePositioning, fakePositioning } from "./positioning"
export { englishLeaks, pseudo, pseudoMessages } from "./pseudo-locale"
export { missingStateStories, type StateStories } from "./state-stories"
export { type SwitchStepInvariants, switchStepInvariants } from "./switch-invariants"
export { type TextFieldStepInvariants, textFieldStepInvariants } from "./text-field-invariants"
export { liveAnnouncements, spokenLog } from "./virtual-sr"
