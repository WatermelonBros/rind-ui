import type {
  AccordionEvent,
  AccordionItemState,
  accordionConnect,
  ClosedContent,
  HeadingLevel,
  ItemKey,
} from "@rind-ui/core"
import { createContext } from "../context"

export const accordionContext = createContext<{
  readonly instance: () => string
  readonly send: (event: AccordionEvent) => void
  readonly openKeys: () => readonly string[]
  readonly api: () => ReturnType<typeof accordionConnect>
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly closedContent: () => ClosedContent
  readonly level: () => HeadingLevel
  readonly triggers: Map<ItemKey, { current: Element | null }>
}>("accordion")
export const accordionItem = createContext<() => AccordionItemState>("accordion-item")
