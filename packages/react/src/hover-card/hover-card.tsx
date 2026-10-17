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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

interface Ctx {
  readonly service: Service<typeof hoverCardMachine>
  readonly root: string
  readonly props: HoverCardProps
  readonly keepMounted: boolean
  readonly hoverIntent: HoverIntent
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
}

const HoverCardContext = createContext<Ctx | null>(null)
function useHoverCard(part: string): Ctx {
  const ctx = useContext(HoverCardContext)
  if (!ctx) throw new Error(`HoverCard.${part} must be inside HoverCard.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while shown. */
function useMeta(root: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(hoverCardLayerId(root))?.meta())
    read()
    return stack.subscribe(read)
  }, [root, env, open])
  return meta
}

function useApi(ctx: Ctx, extra: { dir?: "ltr" | "rtl"; focusWithin?: boolean } = {}) {
  const view = useSelector(ctx.service, (v) => v)
  const open = view.values.open === true
  const meta = useMeta(ctx.root, open)
  return {
    open,
    api: hoverCardConnect(
      {
        instance: ctx.root,
        open,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        contentMounted: ctx.contentMounted,
        meta,
        manual: hoverCardPositioning(ctx.props).mode === "manual",
        ...extra,
      },
      ctx.service.send,
    ),
  }
}

/** What `actionsRef` exposes. */
export interface HoverCardActions {
  open(): void
  close(): void
}

export type HoverCardRootProps = Omit<HoverCardProps, "root" | "parent" | "getTrigger"> & {
  readonly id?: string
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly actionsRef?: Ref<HoverCardActions>
  readonly children?: ReactNode
}

function Root({ id, keepMounted = false, actionsRef, children, ...rest }: HoverCardRootProps) {
  const root = useRootId(id)
  const parent = useParentLayer()
  const env = useEnvironment()
  const hoverEnv = useMemo(
    () => ({ ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }),
    [env],
  )
  const triggerRef = useRef<HTMLElement | null>(null)
  const props: HoverCardProps = { ...rest, root, parent, getTrigger: () => triggerRef.current }
  const { service, send } = useMachine(hoverCardMachine, props, hoverEnv)
  useImperativeHandle(
    actionsRef,
    () => ({
      open: () => send({ type: "OPEN" }),
      close: () => send({ type: "CLOSE", reason: "api" }),
    }),
    [send],
  )
  const [contentMounted, setContentMounted] = useState(false)
  const ctx: Ctx = {
    service,
    root,
    props,
    keepMounted,
    hoverIntent: hoverEnv.hoverIntent,
    triggerRef,
    contentMounted,
    setContentMounted,
  }
  return <HoverCardContext value={ctx}>{children}</HoverCardContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

export interface HoverCardTriggerState {
  readonly open: boolean
}

/** The link that previews: it keeps its role and href. */
function Trigger({ render, ref, ...rest }: Own<"a", HoverCardTriggerState>) {
  const ctx = useHoverCard("Trigger")
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  // Development: a hover card is a link's preview; a button wants a Popover.
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node || node.hasAttribute("href")) return
    console.warn(
      `[rind-ui] hover-card #${node.id}: the trigger is not a link (no href); a hover card is a link's preview — use a Popover for a button`,
    )
  }, [])
  const hover = useMemo(
    () => ctx.hoverIntent.triggerProps((e) => ctx.service.send(e)),
    [ctx.hoverIntent, ctx.service],
  )
  const own = normalizeProps(api.trigger({ focused, hovered, modality }, hover))
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onPointerMove: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse" || e.pointerType === "pen") setHovered(true)
        },
        onPointerLeave: () => setHovered(false),
        onFocus: (e: { currentTarget: Element }) => {
          setFocused(true)
          const f = focusEvent(e.currentTarget, env.modality)
          api.focus(f.modality, f.cause)
        },
        onBlur: () => {
          setFocused(false)
          api.blur()
        },
      }),
      ref: composeRefs(composeRefs(el, ctx.triggerRef), ref),
    },
    rest,
  )
  return renderPart("a", props, render, { open })
}

function usePartPresence(ctx: Ctx, open: boolean, subtree = false) {
  const node = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree })
  return { node, ...presence }
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx, open: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (!open) return
    const found = ctx.triggerRef.current?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.triggerRef])
  return dir
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useHoverCard("Positioner")
  const open = useSelector(ctx.service, (v) => v.values.open === true)
  const dir = useTriggerDir(ctx, open)
  const { api } = useApi(ctx, dir ? { dir } : {})
  // It holds the content: it stays while the content's exit animations run.
  const { node, mounted } = usePartPresence(ctx, open, true)
  if (!mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(api.positioner()),
      hidden: !open && ctx.keepMounted,
      ref: composeRefs(node, ref),
    },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

export interface HoverCardContentState {
  readonly open: boolean
}

function Content({
  render,
  ref,
  children,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...rest
}: Own<"div", HoverCardContentState>) {
  const ctx = useHoverCard("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = useState(false)
  const { api, open } = useApi(ctx, { focusWithin })
  const { node, mounted, state } = usePartPresence(ctx, open)
  const { setContentMounted, service } = ctx
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  // Focus within, from the DOM (native events plus a frame check), reported to the machine.
  useIsoLayoutEffect(() => {
    const el = node.current
    if (!mounted || !el) return
    let inside = false
    const report = (now: boolean) => {
      if (now === inside) return
      inside = now
      setFocusWithin(now)
      service.send({ type: now ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" })
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
    return () => {
      env.scheduler.cancelAnimationFrame(frame)
      el.removeEventListener("focusin", sync)
      el.removeEventListener("focusout", onFocusOut)
    }
  }, [mounted, env, node, service])
  if (!mounted) return null
  const exiting = !open && state === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content({ label, labelledBy })),
      hidden: !open && !exiting && ctx.keepMounted,
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      // Layers opened from here (a select, a nested card) are this card's children.
      children: (
        <LayerProvider layer={hoverCardLayerId(ctx.root)} kind="popover">
          {children}
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, { open })
}

function Arrow({ render, ...rest }: Own<"div">) {
  const ctx = useHoverCard("Arrow")
  const { api } = useApi(ctx)
  return renderPart("div", mergeProps(normalizeProps(api.arrow()), rest), render, undefined)
}

function Portal(props: PortalProps) {
  const ctx = useHoverCard("Portal")
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => ctx.triggerRef.current
  return <PortalPart logicalParent={logicalParent} {...props} />
}

export const HoverCard = { Root, Trigger, Portal, Positioner, Content, Arrow }
