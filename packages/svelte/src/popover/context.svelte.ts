import {
  type HeadingLevel,
  type LayerMeta,
  type Modality,
  type PopoverMessages,
  type PopoverProps,
  popoverConnect,
  popoverIds,
  type popoverMachine,
  popoverPositioning,
  type Service,
} from "@rind-ui/core"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"

export type Rendered = {
  readonly title?: string | undefined
  readonly description?: string | undefined
}
type View = ReturnType<Service<typeof popoverMachine>["view"]>

export interface PopoverHost {
  readonly service: Service<typeof popoverMachine>
  readonly view: () => View
  readonly root: () => string
  readonly scope: () => string
  readonly props: () => PopoverProps
  readonly keepMounted: () => boolean
  readonly messages: () => PopoverMessages
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: {
    contentMounted: boolean
    anchorRendered: boolean
    titleLevel: HeadingLevel
    rendered: Rendered
    /** The stack's metadata for this layer, followed while open. */
    meta: LayerMeta | undefined
  }
}

export const popoverHost = createContext<PopoverHost>("popover")

export const isOpen = (ctx: PopoverHost) => ctx.view().matches("open")

export function api(
  ctx: PopoverHost,
  extra: {
    dir?: "ltr" | "rtl"
    focusWithin?: boolean
    contentFocused?: boolean
    modality?: Modality
  } = {},
) {
  const view = ctx.view()
  const props = ctx.props()
  return popoverConnect(
    {
      instance: ctx.root(),
      scope: ctx.scope(),
      open: view.matches("open"),
      modal: props.modal === true,
      disabled: props.disabled,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      rendered: ctx.shared.rendered,
      contentMounted: ctx.shared.contentMounted,
      anchorRendered: ctx.shared.anchorRendered,
      meta: ctx.shared.meta,
      manual: popoverPositioning(props).mode === "manual",
      ...extra,
      messages: ctx.messages(),
    },
    ctx.service.send,
  )
}

/** Focus and modality of a button part, plus its press. Call during initialisation. */
export function useButton(onPress: (modality: Modality) => void, disabled = () => false) {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  return {
    get focused() {
      return focused
    },
    get modality() {
      return modality.current
    },
    press,
    handlers: {
      onfocus: () => (focused = true),
      onblur: () => (focused = false),
    },
  }
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
export function useAnchorDir(ctx: PopoverHost) {
  const env = useEnvironment()
  let dir = $state<"ltr" | "rtl" | undefined>(undefined)
  $effect(() => {
    if (!isOpen(ctx)) return
    const ids = popoverIds(ctx.root(), ctx.scope())
    const anchor = env.dom.getById(ctx.shared.anchorRendered ? ids.anchor : ids.trigger)
    const found = anchor?.closest("[dir]")?.getAttribute("dir")
    dir = found === "rtl" ? "rtl" : "ltr"
  })
  return {
    get current() {
      return dir
    },
  }
}
