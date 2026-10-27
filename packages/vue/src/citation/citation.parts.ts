// The Citation namespace: a module namespace so bundlers drop the parts never referenced.
// Hover Card's own Portal (a citation sits inside a paragraph: the card, block content, must
// not), Positioner and Content (the card: non-modal, reachable with Tab from the marker).
export { Content, Portal, Positioner } from "../hover-card/hover-card"
export {
  CitedText,
  Root,
  Source,
  SourceLink,
  SourceSnippet,
  SourceTitle,
  SourceUrl,
  Trigger,
} from "./citation"
