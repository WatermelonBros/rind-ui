/** @jsxImportSource solid-js */
// The combobox-pattern popup parts (Positioner, Popup), shared by every host with a popup
// (Combobox, Tags Input): presence with exit animations and the top layer. Wiring only.
import type { PartProps } from "@rind-ui/core"
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
} from "solid-js"
import { keepStyle } from "../keep-style"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

/** What the popup parts read from their host; accessors stay reactive. */
export interface PopupHost {
  /** The component name in warnings ("Combobox", "TagsInput"). */
  readonly name: string
  readonly api: Accessor<{ positioner(): PartProps; popup(): PartProps }>
  readonly open: Accessor<boolean>
  readonly keepMounted: Accessor<boolean>
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: Accessor<boolean>
  /** A list in place: the popup parts render nothing. */
  readonly inline?: boolean | undefined
}

type Own<A> = Omit<A, "children"> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** A list in place: popup parts render nothing (combobox "Anatomy"). */
function warnInline(host: PopupHost, part: string) {
  if (host.inline && process.env.NODE_ENV !== "production") {
    afterMount(() => console.warn(`[rind-ui] ${host.name}: an inline combobox renders no ${part}.`))
  }
}

/* @__NO_SIDE_EFFECTS__ */
export function createPopupParts(useHost: (part: string) => PopupHost) {
  function Positioner(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("Positioner")
    warnInline(host, "Positioner")
    const [node, setNode] = createSignal<Element | null>(null)
    // It holds the popup: it stays while the popup's exit animations run.
    const presence = usePresence(host.open, node, {
      keepMounted: host.keepMounted,
      subtree: () => true,
    })
    createEffect(() => host.setPresent(presence.mounted()))
    // Into the top layer while mounted (`popover="manual"`): above every stacking context of
    // the page, with no portal. Engines without the Popover API keep it in place.
    afterMount(() => {
      createEffect(() => {
        const el = node() as (HTMLElement & { showPopover?: () => void }) | null
        if (!presence.mounted() || !host.topLayer() || !el || typeof el.showPopover !== "function")
          return
        try {
          if (!el.matches(":popover-open")) el.showPopover()
        } catch {
          // Already shown, or not connected yet: the next update retries.
        }
        onCleanup(() => {
          try {
            if (el.matches(":popover-open")) el.hidePopover()
          } catch {
            // Removed with its subtree.
          }
        })
      })
    })
    const merged = createMemo(() => {
      const own = normalizeProps(host.api().positioner())
      return mergeProps(
        {
          ...own,
          hidden: own["hidden"] === true || (!host.open() && host.keepMounted()) || undefined,
          ref: setNode,
        },
        rest,
      )
    })
    const kept = keepStyle(merged)
    const children = () => local.children
    return (
      <Show when={presence.mounted() && !host.inline}>
        {untrack(() =>
          renderPart(local.render, kept, undefined, children, (p) => (
            <div {...p}>{children()}</div>
          )),
        )}
      </Show>
    )
  }

  function Popup(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const host = useHost("Popup")
    warnInline(host, "Popup")
    const [node, setNode] = createSignal<Element | null>(null)
    const presence = usePresence(host.open, node, { keepMounted: host.keepMounted })
    const exiting = () => !host.open() && presence.state() === "exiting"
    const merged = createMemo(() =>
      mergeProps(
        {
          ...normalizeProps(host.api().popup()),
          ...(exiting() ? { inert: true } : {}),
          ref: setNode,
        },
        rest,
      ),
    )
    const children = () => local.children
    return (
      <Show when={presence.mounted() && !host.inline}>
        {untrack(() =>
          renderPart(local.render, merged, undefined, children, (p) => (
            <div {...p}>{children()}</div>
          )),
        )}
      </Show>
    )
  }

  return { Positioner, Popup }
}
