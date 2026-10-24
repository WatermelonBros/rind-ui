// The combobox-pattern popup parts (Positioner, Popup), shared by every host with a popup
// (Combobox, Tags Input): presence with exit animations and the top layer. Wiring only.
import type { PartProps } from "@rind-ui/core"
import { defineComponent, onMounted, shallowRef, watch } from "vue"
import { keepStyle } from "../keep-style"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderPart } from "../render"
import { usePresence } from "../use-presence"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** What the popup parts read from their host; getters stay reactive. */
export interface PopupHost {
  readonly api: () => { positioner(): PartProps; popup(): PartProps }
  readonly open: () => boolean
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: () => boolean
  /** A list in place: the popup parts render nothing. */
  readonly inline?: boolean | undefined
}

/** Inline: popup parts render nothing (combobox "Anatomy"). */
function warnInline(host: PopupHost, name: string, part: string) {
  if (host.inline && process.env.NODE_ENV !== "production") {
    onMounted(() => console.warn(`[rind-ui] ${name}: an inline combobox renders no ${part}.`))
  }
}

/* @__NO_SIDE_EFFECTS__ */
export function createPopupParts(useHost: (part: string) => PopupHost, name: string) {
  const Positioner = defineComponent({
    name: `${name}Positioner`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("Positioner")
      warnInline(host, name, "Positioner")
      const el = shallowRef<Element | null>(null)
      // It holds the popup: it stays while the popup's exit animations run.
      const presence = usePresence(host.open, el, {
        keepMounted: host.keepMounted,
        subtree: () => true,
      })
      watch(
        () => presence.mounted,
        (m) => host.setPresent(m),
        { immediate: true, flush: "post" },
      )
      // Into the top layer while mounted (`popover="manual"`): above every stacking context of
      // the page, with no portal. Engines without the Popover API keep it in place.
      onMounted(() =>
        watch(
          [() => presence.mounted, host.topLayer, el],
          ([mounted, topLayer, node], _, onCleanup) => {
            const pop = node as (HTMLElement & { showPopover?: () => void }) | null
            if (!mounted || !topLayer || !pop || typeof pop.showPopover !== "function") return
            try {
              if (!pop.matches(":popover-open")) pop.showPopover()
            } catch {
              // Already shown, or not connected yet: the next update retries.
            }
            onCleanup(() => {
              try {
                if (pop.matches(":popover-open")) pop.hidePopover()
              } catch {
                // Removed with its subtree.
              }
            })
          },
          { immediate: true, flush: "post" },
        ),
      )
      // Positioning writes to this element's style too.
      const kept = keepStyle()
      return () => {
        if (!presence.mounted || host.inline) return null
        const own = normalizeProps(host.api().positioner())
        const merged = mergeProps(
          {
            ...own,
            hidden: own["hidden"] === true || (!host.open() && host.keepMounted()) || undefined,
            ref: refTo(el),
          },
          attrs,
        )
        return kept(merged, (p) => renderPart("div", p, slots["default"]?.(), props.asChild))
      }
    },
  })

  const Popup = defineComponent({
    name: `${name}Popup`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const host = useHost("Popup")
      warnInline(host, name, "Popup")
      const el = shallowRef<Element | null>(null)
      const presence = usePresence(host.open, el, { keepMounted: host.keepMounted })
      return () => {
        if (!presence.mounted || host.inline) return null
        const exiting = !host.open() && presence.state === "exiting"
        return renderPart(
          "div",
          mergeProps(
            {
              ...normalizeProps(host.api().popup()),
              ...(exiting ? { inert: "" } : {}),
              ref: refTo(el),
            },
            attrs,
          ),
          slots["default"]?.(),
          props.asChild,
        )
      }
    },
  })

  return { Positioner, Popup }
}
