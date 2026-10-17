// Drivers, adapters and model-based tests built on component contracts.

export { platforms, withEngine } from "@rind-ui/core"
export { parseQrPath } from "@rind-ui/core/qr"
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
export { getAlert } from "./components/alert"
export { getAlertDialog } from "./components/alert-dialog"
export { getAvatar } from "./components/avatar"
export { getBadge } from "./components/badge"
export { getBreadcrumbs } from "./components/breadcrumbs"
export { getButton } from "./components/button"
export { getCheckbox } from "./components/checkbox"
export { getCheckboxGroup } from "./components/checkbox-group"
export { getCollapsible } from "./components/collapsible"
export { getColorPicker } from "./components/color-picker"
export { getCombobox } from "./components/combobox"
export { getContextMenu } from "./components/context-menu"
export { getDialog } from "./components/dialog"
export { getDrawer } from "./components/drawer"
export { getField } from "./components/field"
export { getFieldset } from "./components/fieldset"
export { getForm } from "./components/form"
export { getHeading } from "./components/heading"
export { getHoverCard } from "./components/hover-card"
export { getImage } from "./components/image"
export { getLabel } from "./components/label"
export { getLink } from "./components/link"
export { getListbox } from "./components/listbox"
export { getMenu } from "./components/menu"
export { getMeter } from "./components/meter"
export { getNumberInput } from "./components/number-input"
export { getPagination } from "./components/pagination"
export { getPasswordInput } from "./components/password-input"
export { getPinInput } from "./components/pin-input"
export { getPopover } from "./components/popover"
export { getProgress } from "./components/progress"
export { getQrCode, qrCodeDecodingContract } from "./components/qr-code"
export { getRadioGroup } from "./components/radio-group"
export { getScrollArea } from "./components/scroll-area"
export { getSearchField } from "./components/search-field"
export { getSegmentedControl } from "./components/segmented-control"
export { getSelect } from "./components/select"
export { getSeparator } from "./components/separator"
export { getSkeleton } from "./components/skeleton"
export { getSlider } from "./components/slider"
export { getSwitch } from "./components/switch"
export { getTabs } from "./components/tabs"
export { getTagsInput } from "./components/tags-input"
export { getTextField } from "./components/text-field"
export { getToggle } from "./components/toggle"
export { getToggleGroup } from "./components/toggle-group"
export { getToolbar } from "./components/toolbar"
export { getTooltip } from "./components/tooltip"
export { getTour } from "./components/tour"
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
  correctBlock,
  decodeQr,
  type QrDecoded,
  type QrDecodedSegment,
  QrDecodeError,
} from "./qr/decode"
export {
  type SearchFieldStepInvariants,
  searchFieldStepInvariants,
} from "./search-field-invariants"
export { type SliderStepInvariants, sliderStepInvariants } from "./slider-invariants"
export { missingStateStories, type StateStories } from "./state-stories"
export { type SwitchStepInvariants, switchStepInvariants } from "./switch-invariants"
export { type TextFieldStepInvariants, textFieldStepInvariants } from "./text-field-invariants"
export { type VirtualClock, virtualClock } from "./virtual-clock"
export { liveAnnouncements, spokenLog } from "./virtual-sr"
export { expectRindWarning } from "./warning-guard"
