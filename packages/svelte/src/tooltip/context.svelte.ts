import {
  type HoverIntent,
  type Service,
  type TooltipProps,
  tooltipConnect,
  type tooltipMachine,
  tooltipPositioning,
} from "@rind-ui/core"
import { createContext } from "../context"
import { usePresence } from "../use-presence.svelte"

type View = ReturnType<Service<typeof tooltipMachine>["view"]>

export interface TooltipHost {
  readonly service: Service<typeof tooltipMachine>
  readonly view: () => View
  readonly root: () => string
  readonly props: () => TooltipProps
  readonly type: () => "description" | "label"
  readonly hoverIntent: HoverIntent
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: { trigger: HTMLElement | null; contentMounted: boolean }
}
export const tooltipHost = createContext<TooltipHost>("tooltip")

export const isOpen = (ctx: TooltipHost) => ctx.view().values.open

export function api(ctx: TooltipHost, dir?: "ltr" | "rtl") {
  const view = ctx.view()
  return tooltipConnect(
    {
      instance: ctx.root(),
      open: view.values.open,
      instant: view.context.instant,
      placement: view.context.placement,
      type: ctx.type(),
      contentMounted: ctx.shared.contentMounted,
      dir,
      manual: tooltipPositioning(ctx.props()).mode === "manual",
    },
    ctx.service.send,
  )
}

/** Always mounted (the description exists while closed); hidden once the exit ends. */
export function usePart(ctx: TooltipHost, el: () => Element | null) {
  const presence = usePresence(() => isOpen(ctx), el, {
    keepMounted: () => true,
    subtree: () => true,
  })
  return {
    // Hidden only once presence is over: the update that closes is still "present", and
    // hiding there would cut the exit animation.
    get hidden() {
      return !isOpen(ctx) && presence.state === "absent"
    },
  }
}
