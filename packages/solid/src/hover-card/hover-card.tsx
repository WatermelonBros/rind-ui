/** @jsxImportSource solid-js */
import {
  domHoverIntent,
  domPositioning,
  focusEvent,
  getLayerStack,
  type HoverCardProps,
  type HoverIntent,
  hoverCardConnect,
  hoverCardLayerId,
  hoverCardMachine,
  hoverCardPositioning,
  type LayerMeta,
  type Service,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

type View = ReturnType<Service<typeof hoverCardMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof hoverCardMachine>
  readonly view: Accessor<View>
  readonly root: Accessor<string>
  readonly props: Accessor<HoverCardProps>
  readonly keepMounted: Accessor<boolean>
  readonly hoverIntent: HoverIntent
  readonly trigger: Accessor<HTMLElement | null>
  readonly setTrigger: (el: HTMLElement | null) => void
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
  /** The stack's metadata for this layer, followed while shown. */
  readonly meta: Accessor<LayerMeta | undefined>
}

const HoverCardContext = createContext<Ctx>()
function useHoverCard(part: string): Ctx {
  const ctx = useContext(HoverCardContext)
  if (!ctx) throw new Error(`HoverCard.${part} must be inside HoverCard.Root`)
  return ctx
}

const isOpen = (ctx: Ctx) => ctx.view().values.open === true

function useApi(
  ctx: Ctx,
  extra: Accessor<{
    dir?: "ltr" | "rtl" | undefined
    focusWithin?: boolean | undefined
  }> = () => ({}),
) {
  return createMemo(() => {
    const view = ctx.view()
    return hoverCardConnect(
      {
        instance: ctx.root(),
        open: view.values.open === true,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        contentMounted: ctx.contentMounted(),
        meta: ctx.meta(),
        manual: hoverCardPositioning(ctx.props()).mode === "manual",
        ...extra(),
      } as Parameters<typeof hoverCardConnect>[0],
      ctx.service.send,
    )
  })
}

/** What `actionsRef` exposes. */
export interface HoverCardActions {
  open(): void
  close(): void
}

export type HoverCardRootProps = Omit<HoverCardProps, "root" | "parent" | "getTrigger"> & {
  /** Base for the ids of the hover card's parts. Default: generated. */
  readonly id?: string | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: HoverCardActions) => void) | undefined
  /** The hover card's parts (Root renders no element). */
  readonly children?: JSX.Element
}

function Root(props: HoverCardRootProps) {
  const [own, rest] = splitProps(props, ["id", "keepMounted", "actionsRef", "children"])
  const root = useRootId(() => own.id)
  const parent = useParentLayer()
  const env = useEnvironment()
  const hoverEnv = {
    ...env,
    position: domPositioning(env),
    hoverIntent: domHoverIntent(env),
  }
  let triggerEl: HTMLElement | null = null
  const [trigger, setTriggerSignal] = createSignal<HTMLElement | null>(null)
  const machineProps = (): HoverCardProps =>
    ({ ...rest, root: root(), parent: parent(), getTrigger: () => triggerEl }) as HoverCardProps
  const { view, send, service } = useMachine(hoverCardMachine, machineProps, hoverEnv)
  own.actionsRef?.({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) })
  const [contentMounted, setContentMounted] = createSignal(false)
  const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const open = view().values.open === true
      const id = root()
      setMeta(undefined)
      if (!open) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => setMeta(stack.get(hoverCardLayerId(id))?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  const ctx: Ctx = {
    service,
    view,
    root,
    props: machineProps,
    keepMounted: () => own.keepMounted === true,
    hoverIntent: hoverEnv.hoverIntent,
    trigger,
    setTrigger: (el) => {
      triggerEl = el
      setTriggerSignal(el)
    },
    contentMounted,
    setContentMounted,
    meta,
  }
  return <HoverCardContext.Provider value={ctx}>{own.children}</HoverCardContext.Provider>
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

export interface HoverCardTriggerState {
  readonly open: boolean
}

export type HoverCardTriggerProps = Own<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  HoverCardTriggerState
>

/** The link that previews: it keeps its role and href. */
function Trigger(props: HoverCardTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useHoverCard("Trigger")
  const api = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const [hovered, setHovered] = createSignal(false)
  const modality = useModality(env.modality, focused)
  // Development: a hover card is a link's preview; a button wants a Popover.
  afterMount(() => {
    const node = ctx.trigger()
    if (process.env.NODE_ENV === "production" || !node || node.hasAttribute("href")) return
    // A link-less citation marker is a button by design (add-citation §1).
    if (node.getAttribute("data-scope") === "citation") return
    console.warn(
      `[rind-ui] hover-card #${node.id}: the trigger is not a link (no href); a hover card is a link's preview — use a Popover for a button`,
    )
  })
  const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
  const state = reactive<HoverCardTriggerState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().trigger({ focused: focused(), hovered: hovered(), modality: modality() }, hover),
          ),
          {
            onPointerMove: (e: PointerEvent) => {
              if (e.pointerType === "mouse" || e.pointerType === "pen") setHovered(true)
            },
            onPointerLeave: () => setHovered(false),
            onFocusIn: (e: FocusEvent) => {
              setFocused(true)
              const f = focusEvent(e.currentTarget as Element, env.modality)
              untrack(api).focus(f.modality, f.cause)
            },
            onFocusOut: () => {
              setFocused(false)
              untrack(api).blur()
            },
          },
        ),
        ref: (el: Element) => ctx.setTrigger(el as HTMLElement),
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => <a {...p}>{children()}</a>)
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx) {
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      if (!isOpen(ctx)) return
      const found = ctx.trigger()?.closest("[dir]")?.getAttribute("dir")
      setDir(found === "rtl" ? "rtl" : "ltr")
    })
  })
  return dir
}

export type HoverCardDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Positioner(props: HoverCardDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useHoverCard("Positioner")
  const dir = useTriggerDir(ctx)
  const api = useApi(ctx, () => (dir() ? { dir: dir() } : {}))
  const [node, setNode] = createSignal<Element | null>(null)
  // It holds the content: it stays while the content's exit animations run.
  const presence = usePresence(() => isOpen(ctx), node, {
    keepMounted: ctx.keepMounted,
    subtree: () => true,
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().positioner()),
        hidden: !isOpen(ctx) && ctx.keepMounted(),
        ref: setNode,
      },
      rest,
    ),
  )
  // Positioning writes this element's style too.
  const kept = keepStyle(merged)
  const children = () => local.children
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

export interface HoverCardContentState {
  readonly open: boolean
}

export type HoverCardContentProps = Own<JSX.HTMLAttributes<HTMLDivElement>, HoverCardContentState>

function Content(props: HoverCardContentProps) {
  const [local, rest] = splitProps(props, ["render", "children", "aria-label", "aria-labelledby"])
  const ctx = useHoverCard("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = createSignal(false)
  const api = useApi(ctx, () => ({ focusWithin: focusWithin() }))
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, { keepMounted: ctx.keepMounted })
  afterMount(() => {
    createEffect(() => {
      const el = presence.mounted() ? node() : null
      ctx.setContentMounted(el !== null)
      if (!(el instanceof HTMLElement)) return
      onCleanup(() => ctx.setContentMounted(false))
      // Focus within, from the DOM (native events plus a frame check), reported to the machine.
      let inside = false
      const report = (now: boolean) => {
        if (now === inside) return
        inside = now
        setFocusWithin(now)
        ctx.service.send({ type: now ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" })
      }
      const sync = () => {
        const active = el.ownerDocument.activeElement
        report(active !== null && el.contains(active))
      }
      const onFocusOut = (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null
        if (next && el.contains(next)) return
        report(false)
      }
      sync()
      const frame = env.scheduler.requestAnimationFrame(sync)
      el.addEventListener("focusin", sync)
      el.addEventListener("focusout", onFocusOut)
      onCleanup(() => {
        env.scheduler.cancelAnimationFrame(frame)
        el.removeEventListener("focusin", sync)
        el.removeEventListener("focusout", onFocusOut)
      })
    })
  })
  const exiting = () => !isOpen(ctx) && presence.state() === "exiting"
  const state = reactive<HoverCardContentState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().content({ label: local["aria-label"], labelledBy: local["aria-labelledby"] }),
        ),
        hidden: !isOpen(ctx) && !exiting() && ctx.keepMounted(),
        ...(exiting() ? { inert: true } : {}),
        ref: setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  // Layers opened from here (a select, a nested card) are this card's children.
  const children = () => (
    <LayerProvider layer={hoverCardLayerId(ctx.root())} kind="popover">
      {local.children}
    </LayerProvider>
  )
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, state, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

function Arrow(props: HoverCardDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useHoverCard("Arrow")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().arrow()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Portal(props: PortalProps) {
  const ctx = useHoverCard("Portal")
  // The host carries the trigger's theme, dir and lang.
  return <PortalPart logicalParent={ctx.trigger} {...props} />
}

/** The parts, by name: `hover-card.parts.ts` re-exports them as the `HoverCard` namespace. */
export { Arrow, Content, Portal, Positioner, Root, Trigger }
