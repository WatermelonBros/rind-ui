// The combobox-pattern popup parts (Positioner, Popup), shared by every host with a popup
// (Combobox, Tags Input): presence with exit animations and the top layer. Wiring only.

import type { PartProps } from "@rind-ui/core"
import { type ComponentPropsWithRef, useEffect, useLayoutEffect, useRef } from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { usePresence } from "../use-presence"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

declare const process: { env: { NODE_ENV?: string } }

/** What the popup parts read from their host. */
export interface PopupHost {
  /** The component name in warnings ("Combobox", "TagsInput"). */
  readonly name: string
  readonly api: { positioner(): PartProps; popup(): PartProps }
  readonly open: boolean
  readonly keepMounted: boolean
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: boolean
  /** A list in place: the popup parts render nothing. */
  readonly inline?: boolean | undefined
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

/** A list in place: popup parts render nothing (combobox "Anatomy"). */
function useInlineWarning(host: PopupHost, part: string) {
  useEffect(() => {
    if (host.inline && process.env.NODE_ENV !== "production") {
      console.warn(`[rind-ui] ${host.name}: an inline combobox renders no ${part}.`)
    }
  }, [host.inline, host.name, part])
}

export function createPopupParts(useHost: (part: string) => PopupHost) {
  function Positioner({ render, ref, children, ...rest }: Own<"div">) {
    const host = useHost("Positioner")
    useInlineWarning(host, "Positioner")
    const node = useRef<HTMLElement | null>(null)
    // It holds the popup: it stays while the popup's exit animations run.
    const { mounted } = usePresence(host.open, node, {
      keepMounted: host.keepMounted,
      subtree: true,
    })
    const { setPresent, topLayer } = host
    useIsoLayoutEffect(() => {
      setPresent(mounted)
    }, [mounted, setPresent])
    // Into the top layer while mounted (`popover="manual"`): above every stacking context of
    // the page, with no portal. Engines without the Popover API keep it in place.
    useIsoLayoutEffect(() => {
      const el = node.current as (HTMLElement & { showPopover?: () => void }) | null
      if (!mounted || !topLayer || !el || typeof el.showPopover !== "function") return
      try {
        if (!el.matches(":popover-open")) el.showPopover()
      } catch {
        // Already shown, or not connected yet: the next commit retries.
      }
      return () => {
        try {
          if (el.matches(":popover-open")) el.hidePopover()
        } catch {
          // Removed with its subtree.
        }
      }
    }, [mounted, topLayer])
    if (!mounted || host.inline) return null
    const own = normalizeProps(host.api.positioner())
    const props = mergeProps(
      {
        ...own,
        hidden: own["hidden"] === true || (!host.open && host.keepMounted) || undefined,
        ref: composeRefs(node, ref),
      },
      { ...rest, children },
    )
    return renderPart("div", props, render, undefined)
  }

  function Popup({ render, ref, ...rest }: Own<"div">) {
    const host = useHost("Popup")
    useInlineWarning(host, "Popup")
    const node = useRef<HTMLElement | null>(null)
    const { mounted, state } = usePresence(host.open, node, { keepMounted: host.keepMounted })
    if (!mounted || host.inline) return null
    const exiting = !host.open && state === "exiting"
    return renderPart(
      "div",
      mergeProps(
        {
          ...normalizeProps(host.api.popup()),
          ...(exiting ? { inert: true } : {}),
          ref: composeRefs(node, ref),
        },
        rest,
      ),
      render,
      undefined,
    )
  }

  return { Positioner, Popup }
}
