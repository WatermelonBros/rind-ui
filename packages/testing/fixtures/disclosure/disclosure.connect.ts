import {
  CRITICAL,
  focusAttrs,
  type Modality,
  type PartProps,
  partId,
  scopeAttrs,
} from "@rind-ui/core"
import type { DisclosureEvent } from "./disclosure.machine"

export type DisclosurePart = "root" | "trigger" | "content"

export interface DisclosureIds {
  readonly root: string
  /** Final ids of the parts currently rendered. */
  readonly rendered: Partial<Record<DisclosurePart, string>>
}

/** Disclosure state → framework-neutral props per part. */
export function connect(
  state: {
    readonly open: boolean
    /** Opened by find-in-page (data-reveal, for this transition). */
    readonly revealed?: boolean
    readonly hiddenUntilFound?: boolean
    /** The trigger has focus, and the current modality (for data-focus-visible). */
    readonly triggerFocused?: boolean
    readonly modality?: Modality
  },
  send: (event: DisclosureEvent) => void,
  ids: DisclosureIds,
) {
  const dataState = state.open ? "open" : "closed"
  const scope = (part: DisclosurePart) => ({
    ...scopeAttrs("disclosure", part, ids.root),
    "data-state": dataState,
  })
  return {
    open: state.open,
    root: (): PartProps => scope("root"),
    trigger: (): PartProps => ({
      ...scope("trigger"),
      id: partId("disclosure", ids.root, "trigger"),
      type: "button",
      "aria-expanded": String(state.open),
      "aria-controls": ids.rendered.content,
      onClick: () => send({ type: "TOGGLE" }),
      ...focusAttrs(state.triggerFocused === true, state.modality ?? "keyboard"),
      [CRITICAL]: ["aria-expanded", "aria-controls"],
    }),
    content: (): PartProps => ({
      ...scope("content"),
      id: partId("disclosure", ids.root, "content"),
      // React 19 serialises hidden as a boolean (server HTML: hidden=""); the part upgrades
      // it to until-found after hydration and re-applies it after every commit.
      hidden: state.open ? undefined : true,
      "data-reveal": state.open && state.revealed ? "find-in-page" : undefined,
    }),
  }
}
