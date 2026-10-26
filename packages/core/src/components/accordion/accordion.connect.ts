// Accordion parts (design §3): what the accordion adds to each item's Collapsible parts —
// the header (heading semantics), the lock, the region rule, the orientation and the
// optional trigger navigation. Collapsible's connect gives the rest, scoped "accordion".

import { type KeyDescription, toLogicalKey } from "../../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { PlatformFlags } from "../../env/capabilities"
import type { HeadingLevel } from "../heading/heading.connect"
import { headingProps } from "../heading/heading.connect"
import { type AccordionEvent, type ItemKey, isLocked } from "./accordion.machine"

export type AccordionPart = "root" | "item" | "header" | "trigger" | "content" | "indicator"
export type AccordionOrientation = "vertical" | "horizontal"

export interface AccordionConnectInput {
  readonly instance: string
  readonly orientation: AccordionOrientation
  readonly dir: "ltr" | "rtl"
  readonly platform: PlatformFlags
  readonly disabled: boolean
  readonly multiple: boolean
  readonly collapsible: boolean
  readonly keyboardNavigation: boolean
  /** Every registered item, enabled or not (the region rule counts them all). */
  readonly itemCount: number
  /** Overrides the region rule. */
  readonly contentRole: "region" | "none" | undefined
}

export interface AccordionItemState {
  readonly item: ItemKey
  readonly open: boolean
  /** The item's own `disabled` or the root's. */
  readonly disabled: boolean
}

/** A trigger key event, as the adapter sees it. */
export interface TriggerKeyEvent extends KeyDescription {
  /** The event's target is the trigger itself (not something inside it). */
  readonly onTrigger: boolean
  preventDefault(): void
}

export function accordionConnect(input: AccordionConnectInput, send: (e: AccordionEvent) => void) {
  const orientation = { "data-orientation": input.orientation }
  const locked = (s: AccordionItemState) => s.open && isLocked(input)
  const region =
    input.contentRole !== undefined
      ? input.contentRole === "region"
      : !input.multiple || input.itemCount <= 6
  const state = (s: AccordionItemState) => ({
    "data-state": s.open ? "open" : "closed",
    "data-disabled": dataFlag(s.disabled),
    ...orientation,
  })
  return {
    root: (): PartProps => ({
      ...scopeAttrs("accordion", "root", input.instance),
      ...orientation,
      "data-disabled": dataFlag(input.disabled),
    }),
    item: (s: AccordionItemState): PartProps => ({
      ...scopeAttrs("accordion", "item", input.instance),
      ...state(s),
    }),
    /** `tag`: the rendered element (a substituted header gets role heading + aria-level). */
    header: (s: AccordionItemState, level: HeadingLevel, tag: string): PartProps => ({
      ...scopeAttrs("accordion", "header", input.instance),
      ...headingProps({ level, tag }),
      ...state(s),
    }),
    /** Added to the item's Collapsible trigger. */
    trigger: (s: AccordionItemState): PartProps => ({
      ...orientation,
      // The lock: focusable, announced as unavailable, ignores activation (machine guard).
      ...(locked(s) ? { "aria-disabled": "true", "data-disabled": "" } : {}),
      onKeyDown: (e: TriggerKeyEvent) => {
        if (!input.keyboardNavigation || !e.onTrigger || e.composing) return
        // Modified keys stay the browser's (Ctrl/Cmd+Home scrolls the page, base-ui#1465).
        if (e.alt || e.ctrl || e.meta) return
        const logical = toLogicalKey(e, {
          dir: input.dir,
          orientation: input.orientation,
          platform: input.platform,
        })
        const type =
          logical === "NEXT"
            ? "FOCUS.NEXT"
            : logical === "PREV"
              ? "FOCUS.PREV"
              : logical === "FIRST"
                ? "FOCUS.FIRST"
                : logical === "LAST"
                  ? "FOCUS.LAST"
                  : undefined
        if (type === undefined) return
        // Only the keys it consumed; never stops propagation.
        e.preventDefault()
        send({ type, from: s.item })
      },
    }),
    /** Added to the item's Collapsible content: the region rule, while open only. */
    content: (s: AccordionItemState, triggerId: string): PartProps => ({
      ...orientation,
      ...(s.open && region ? { role: "region", "aria-labelledby": triggerId } : {}),
    }),
    indicator: (): PartProps => orientation,
  }
}
