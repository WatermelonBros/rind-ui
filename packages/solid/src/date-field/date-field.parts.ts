// The DateField namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references.

// The popover's own parts: the picker's portal, positioner and close button.
export {
  /** Closes without picking; a modal picker needs it (touch screen readers have no Escape). */
  CloseTrigger,
  Portal,
  Positioner,
} from "../popover/popover.parts"
export {
  Calendar,
  ClearTrigger,
  Content,
  Control,
  Description,
  End,
  ErrorMessage,
  Input,
  Label,
  Root,
  Segment,
  Separator,
  Start,
  Trigger,
} from "./date-field"
