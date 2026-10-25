import { FieldDescription, FieldErrorMessage, FieldLabel } from "../field/field"
import { PopoverCloseTrigger, PopoverPortal, PopoverPositioner } from "../popover/popover"
import {
  DateFieldEnd,
  DateFieldInput,
  DateFieldRoot,
  DateFieldSegment,
  DateFieldSeparator,
  DateFieldStart,
} from "./date-field"
import {
  DateFieldCalendar,
  DateFieldClearTrigger,
  DateFieldContent,
  DateFieldControl,
  DateFieldTrigger,
} from "./date-picker"
import { DateRangeFieldRoot } from "./date-range-field"

export type { DateFieldState } from "./context"
export {
  type DateFieldChangeDetails,
  DateFieldEnd,
  DateFieldInput,
  DateFieldRoot,
  DateFieldSegment,
  DateFieldSeparator,
  DateFieldStart,
  type DateFieldValueEvent,
  type DatePickerCloseReason,
  type DatePickerOpenChangeDetails,
  type DatePickerOpenEvent,
} from "./date-field"
export {
  DateFieldCalendar,
  DateFieldClearTrigger,
  DateFieldContent,
  DateFieldControl,
  DateFieldTrigger,
} from "./date-picker"
export {
  type DateRangeFieldChangeDetails,
  DateRangeFieldRoot,
  type DateRangeFieldValueEvent,
} from "./date-range-field"

/**
 * The Date Field's parts, for a standalone component's `imports` (its Label, Description and
 * ErrorMessage are the Field's, its Portal, Positioner and CloseTrigger the Popover's).
 */
export const DateField = [
  DateFieldRoot,
  DateRangeFieldRoot,
  FieldLabel,
  FieldDescription,
  FieldErrorMessage,
  DateFieldInput,
  DateFieldSegment,
  DateFieldStart,
  DateFieldEnd,
  DateFieldSeparator,
  DateFieldControl,
  DateFieldTrigger,
  DateFieldClearTrigger,
  PopoverPortal,
  PopoverPositioner,
  DateFieldContent,
  DateFieldCalendar,
  PopoverCloseTrigger,
] as const
