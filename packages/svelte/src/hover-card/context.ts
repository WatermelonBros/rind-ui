import {
  type HoverCardProps,
  type HoverIntent,
  hoverCardConnect,
  type hoverCardMachine,
  hoverCardPositioning,
  type LayerMeta,
  type Service,
} from "@rind-ui/core"
import { createContext } from "../context"

type View = ReturnType<Service<typeof hoverCardMachine>["view"]>

export interface HoverCardHost {
  readonly service: Service<typeof hoverCardMachine>
  readonly view: () => View
  readonly root: () => string
  readonly props: () => HoverCardProps
  readonly keepMounted: () => boolean
  readonly hoverIntent: HoverIntent
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: {
    trigger: HTMLElement | null
    contentMounted: boolean
    /** The stack's metadata for this layer, followed while shown. */
    meta: LayerMeta | undefined
  }
}
export const hoverCardHost = createContext<HoverCardHost>("hover-card")

export const isOpen = (ctx: HoverCardHost) => ctx.view().values.open === true

export function api(
  ctx: HoverCardHost,
  extra: { dir?: "ltr" | "rtl"; focusWithin?: boolean } = {},
) {
  const view = ctx.view()
  return hoverCardConnect(
    {
      instance: ctx.root(),
      open: view.values.open === true,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      contentMounted: ctx.shared.contentMounted,
      meta: ctx.shared.meta,
      manual: hoverCardPositioning(ctx.props()).mode === "manual",
      ...extra,
    },
    ctx.service.send,
  )
}
