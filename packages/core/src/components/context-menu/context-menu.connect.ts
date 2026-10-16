// Context Menu region (design §2, §4): the element a secondary action opens the menu from.
// No popup ARIA (the region is not a button), the consumer's tabindex untouched, the
// long-press hint when focusable. Nested regions: the innermost claims the gesture.

import { toLogicalKey } from "../../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { describeKey } from "../../dom/keyboard"
import type { ModalityEnv, PlatformInfo } from "../../env/capabilities"
import type { MenuEvent } from "../menu/menu.machine"

/** Gestures an inner region already took (an outer one sees the same event bubble). */
const claimed = new WeakSet<object>()

/** Claims `event` for the innermost region; false when an inner region already did. */
export function claimRegionEvent(event: unknown): boolean {
  const native = ((event as { nativeEvent?: object }).nativeEvent ?? event) as object
  if (claimed.has(native)) return false
  claimed.add(native)
  return true
}

export interface ContextMenuRegionInput {
  readonly instance: string
  readonly open: boolean
  readonly disabled: boolean
  /** The hint's id, when the region is focusable and long press is on. */
  readonly hintId?: string | undefined
}

export type ContextMenuConnectEnv = PlatformInfo &
  ModalityEnv & { readonly locale: { dir(): "ltr" | "rtl" } }

export function contextMenuRegionProps(
  input: ContextMenuRegionInput,
  send: (event: MenuEvent) => void,
  env: ContextMenuConnectEnv,
): PartProps {
  return {
    ...scopeAttrs("context-menu", "trigger", input.instance),
    "aria-describedby": input.hintId,
    "data-state": input.open ? "open" : "closed",
    "data-disabled": dataFlag(input.disabled),
    onContextMenu: (event: unknown) => {
      const e = event as MouseEvent
      // A descendant that handled it (a link's own menu), a disabled root, or an inner
      // region: the browser's menu, or the inner one.
      if (input.disabled || e.defaultPrevented || !claimRegionEvent(e)) return
      e.preventDefault()
      // No pointer press before it: the keyboard's or assistive technology's request.
      const m = env.modality.modality()
      send({
        type: "REGION.CONTEXTMENU",
        point: { x: e.clientX, y: e.clientY },
        target: e.target as Element | null,
        virtual: m === "virtual" || m === "keyboard",
        nativeEvent: e,
      })
    },
    onKeyDown: (event: unknown) => {
      const e = event as KeyboardEvent
      if (input.disabled || e.defaultPrevented) return
      const k = describeKey(e, env)
      if (k.composing) return
      const logical = toLogicalKey(k, {
        dir: env.locale.dir(),
        orientation: "vertical",
        platform: env.platform,
      })
      if (logical !== "CONTEXT_MENU" || !claimRegionEvent(e)) return
      // The browser's own menu would follow the key.
      e.preventDefault()
      send({ type: "REGION.KEY", target: e.target as Element | null, nativeEvent: e })
    },
  }
}
