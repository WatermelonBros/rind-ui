// The FloatingPanel namespace: a module namespace so bundlers drop the parts never referenced.
// Trigger, CloseTrigger and Portal are the Dialog's own (the panel is a non-modal dialog).
export { CloseTrigger, Portal, Trigger } from "../dialog/dialog"
export {
  Body,
  Content,
  Control,
  Description,
  DragTrigger,
  Header,
  Positioner,
  ResizeTrigger,
  Root,
  StageTrigger,
  Title,
} from "./floating-panel"
