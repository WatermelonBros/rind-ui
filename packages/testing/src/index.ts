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
export { canonicalHtml } from "./canonical-html"
export { type CheckboxStepInvariants, checkboxStepInvariants } from "./checkbox-invariants"
export type { DomSnapshot, ElementInfo, IdRef } from "./collect"
export { getAccordion } from "./components/accordion"
export { getAgentPresence } from "./components/agent-presence"
export { getAlert } from "./components/alert"
export { getAvatar } from "./components/avatar"
export { getBadge } from "./components/badge"
export { getBreadcrumbs } from "./components/breadcrumbs"
export { getButton } from "./components/button"
export { getCalendar } from "./components/calendar"
export { getCheckbox } from "./components/checkbox"
export { getCheckboxGroup } from "./components/checkbox-group"
export { getClipboard } from "./components/clipboard"
export { getCodeBlock } from "./components/code-block"
export { getCollapsible } from "./components/collapsible"
export { getColorPicker } from "./components/color-picker"
export { getCombobox } from "./components/combobox"
export { getContextMenu } from "./components/context-menu"
export { getDateField } from "./components/date-field"
export { getDialog } from "./components/dialog"
export { getDrawer } from "./components/drawer"
export { getField } from "./components/field"
export { getFieldset } from "./components/fieldset"
export { getFileUpload } from "./components/file-upload"
export { getForm } from "./components/form"
export { getGridList } from "./components/grid-list"
export { getHeading } from "./components/heading"
export { getHoverCard } from "./components/hover-card"
export { getImage } from "./components/image"
export { getImageCropper } from "./components/image-cropper"
export { getImageViewer } from "./components/image-viewer"
export { getKbd } from "./components/kbd"
export { getLabel } from "./components/label"
export { getLink } from "./components/link"
export { getListbox } from "./components/listbox"
export { getMarquee } from "./components/marquee"
export { getMenu } from "./components/menu"
export { getMenubar } from "./components/menubar"
export { getMessageThread } from "./components/message-thread"
export { getMeter } from "./components/meter"
export { getNavigationMenu } from "./components/navigation-menu"
export { getNumberInput } from "./components/number-input"
export { getPagination } from "./components/pagination"
export { getPinInput } from "./components/pin-input"
export { getPopover } from "./components/popover"
export { getProgress } from "./components/progress"
export { getPromptInput } from "./components/prompt-input"
export { getQrCode, qrCodeDecodingContract } from "./components/qr-code"
export { getRadioGroup } from "./components/radio-group"
export { getRating } from "./components/rating"
export { getReasoning } from "./components/reasoning"
export { getScrollArea } from "./components/scroll-area"
export { getSegmentedControl } from "./components/segmented-control"
export { getSelect } from "./components/select"
export { getSeparator } from "./components/separator"
export { getSkeleton } from "./components/skeleton"
export { getSlider } from "./components/slider"
export { getSortable } from "./components/sortable"
export { getSplitter } from "./components/splitter"
export { getStepper } from "./components/stepper"
export { getStreamingMessage } from "./components/streaming-message"
export { getSwitch } from "./components/switch"
export { getTable } from "./components/table"
export { getTableOfContents } from "./components/table-of-contents"
export { getTabs } from "./components/tabs"
export { getTagGroup } from "./components/tag-group"
export { getTagsInput } from "./components/tags-input"
export { getTextField } from "./components/text-field"
export { getTimeline } from "./components/timeline"
export { getToast, getToaster } from "./components/toast"
export { getToggle } from "./components/toggle"
export { getToggleGroup } from "./components/toggle-group"
export { getToolbar } from "./components/toolbar"
export { getTooltip } from "./components/tooltip"
export { getTour } from "./components/tour"
export { getTreeView } from "./components/tree-view"
export { fixedDateClock } from "./date-clock"
export {
  type DateFieldStepInvariants,
  dateFieldStepInvariants,
  dateRangeStepInvariants,
} from "./date-field-invariants"
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
export {
  type FakeClipboard,
  type FakeClipboardMode,
  type FakeClipboardOptions,
  fakeClipboard,
} from "./fake-clipboard"
export { type FakeVisibility, fakeVisibility } from "./fake-visibility"
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
export { type SliderStepInvariants, sliderStepInvariants } from "./slider-invariants"
export { missingStateStories, type StateStories } from "./state-stories"
export { type SwitchStepInvariants, switchStepInvariants } from "./switch-invariants"
export { type TextFieldStepInvariants, textFieldStepInvariants } from "./text-field-invariants"
export {
  type TextFieldKeyStepInvariants,
  textFieldKeyStepInvariants,
} from "./text-field-key-invariants"
export { type VirtualClock, virtualClock } from "./virtual-clock"
export { liveAnnouncements, spokenLog } from "./virtual-sr"
export { allowRindWarning, expectRindWarning } from "./warning-guard"
