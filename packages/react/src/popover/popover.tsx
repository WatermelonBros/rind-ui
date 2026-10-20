"use client"

import {
  domPositioning,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type PopoverMessages,
  type PopoverProps,
  partId,
  popoverConnect,
  popoverIds,
  popoverLayerId,
  popoverMachine,
  popoverMessages,
  popoverPositioning,
  type Service,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type Dispatch,
  type ReactNode,
  type Ref,
  type SetStateAction,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Heading } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    popover: PopoverMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

interface Ctx {
  readonly service: Service<typeof popoverMachine>
  readonly root: string
  readonly scope: string
  readonly props: PopoverProps
  readonly keepMounted: boolean
  readonly messages: PopoverMessages
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
  readonly anchorRendered: boolean
  readonly setAnchorRendered: (on: boolean) => void
  readonly titleLevel: HeadingLevel
  readonly setTitleLevel: (level: HeadingLevel) => void
  readonly rendered: Rendered
  readonly setRendered: Dispatch<SetStateAction<Rendered>>
}

const PopoverContext = createContext<Ctx | null>(null)
function usePopover(part: string): Ctx {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error(`Popover.${part} must be inside Popover.Root`)
  return ctx
}

/**
 * For components composed on the Popover (Date Field's picker): the enclosing Popover's open
 * state and its machine's `send`, or null outside one. Not exported from the package.
 */
export function usePopoverControls(): {
  readonly open: boolean
  readonly send: Service<typeof popoverMachine>["send"]
} | null {
  const ctx = useContext(PopoverContext)
  const open = useSelectorOrNull(ctx?.service ?? null)
  return ctx ? { open, send: ctx.service.send } : null
}

const noSubscribe = () => () => {}
/** Whether a service that may be absent (hooks run unconditionally) is open. */
function useSelectorOrNull(service: Service<typeof popoverMachine> | null): boolean {
  const get = () => service?.getSnapshot().state === "open"
  return useSyncExternalStore(service ? service.subscribe : noSubscribe, get, get)
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(root: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(popoverLayerId(root))?.meta())
    read()
    return stack.subscribe(read)
  }, [root, env, open])
  return meta
}

function useApi(
  ctx: Ctx,
  extra: {
    dir?: "ltr" | "rtl"
    focusWithin?: boolean
    contentFocused?: boolean
    modality?: Parameters<typeof popoverConnect>[0]["modality"]
  } = {},
) {
  const view = useSelector(ctx.service, (v) => v)
  const open = view.matches("open")
  const meta = useMeta(ctx.root, open)
  return {
    open,
    api: popoverConnect(
      {
        instance: ctx.root,
        scope: ctx.scope,
        open,
        modal: ctx.props.modal === true,
        disabled: ctx.props.disabled,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        rendered: ctx.rendered,
        contentMounted: ctx.contentMounted,
        anchorRendered: ctx.anchorRendered,
        meta,
        manual: popoverPositioning(ctx.props).mode === "manual",
        ...extra,
        messages: ctx.messages,
      },
      ctx.service.send,
    ),
  }
}

/** What `actionsRef` exposes. */
export interface PopoverActions {
  open(): void
  close(): void
  /** Recomputes the position (a moved anchor the tracking cannot see). */
  reposition(): void
}

export type PopoverRootProps = Omit<PopoverProps, "root" | "parent" | "anchored" | "scope"> & {
  /** Base for the ids of the popover's parts. Default: generated. */
  readonly id?: string
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly messages?: MessageOverrides<PopoverMessages>
  readonly actionsRef?: Ref<PopoverActions>
  /** The popover's parts: its trigger, anchor, portal, positioner and content. */
  readonly children?: ReactNode
}

function Root({
  id,
  keepMounted = false,
  messages: ownMessages,
  actionsRef,
  children,
  ...rest
}: PopoverRootProps & Pick<PopoverProps, "scope">) {
  const root = useRootId(id)
  const parent = useParentLayer()
  const messages = useMessages("popover", popoverMessages, ownMessages)
  const env = useEnvironment()
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = useMemo(() => ({ ...env, position: domPositioning(env) }), [env])
  const [anchorRendered, setAnchorRendered] = useState(false)
  const props: PopoverProps = { ...rest, root, parent, anchored: anchorRendered }
  const { service, send } = useMachine(popoverMachine, props, withPosition)
  useImperativeHandle(
    actionsRef,
    () => ({
      open: () => send({ type: "open" }),
      close: () => send({ type: "api", close: true }),
      reposition: () => send({ type: "POSITION.REPOSITION" }),
    }),
    [send],
  )
  const [contentMounted, setContentMounted] = useState(false)
  const [titleLevel, setTitleLevel] = useState<HeadingLevel>(2)
  const [rendered, setRendered] = useState<Rendered>({})
  const ctx: Ctx = {
    service,
    root,
    scope: rest.scope ?? "popover",
    props,
    keepMounted,
    messages,
    contentMounted,
    setContentMounted,
    anchorRendered,
    setAnchorRendered,
    titleLevel,
    setTitleLevel,
    rendered,
    setRendered,
  }
  return <PopoverContext value={ctx}>{children}</PopoverContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<S>
}

export interface PopoverTriggerState {
  readonly open: boolean
}

function Trigger({ render, ref, ...rest }: Own<"button", PopoverTriggerState>) {
  const ctx = usePopover("Trigger")
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressTrigger(e.modality)
    },
    disabled: () => ctx.props.disabled === true,
  })
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const own = normalizeProps(api.trigger({ focused, modality, pressed: press.pressed, tag }))
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open })
}

/** Optional: positions the content against this element instead of the trigger. */
function Anchor({ render, ...rest }: Own<"div">) {
  const ctx = usePopover("Anchor")
  const { api } = useApi(ctx)
  const { setAnchorRendered } = ctx
  useIsoLayoutEffect(() => {
    setAnchorRendered(true)
    return () => setAnchorRendered(false)
  }, [setAnchorRendered])
  return renderPart("div", mergeProps(normalizeProps(api.anchor()), rest), render, undefined)
}

function Indicator({ render, ...rest }: Own<"span">) {
  const ctx = usePopover("Indicator")
  const { api } = useApi(ctx)
  return renderPart("span", mergeProps(normalizeProps(api.indicator()), rest), render, undefined)
}

function usePartPresence(ctx: Ctx, open: boolean, subtree = false) {
  const node = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree })
  return { node, ...presence }
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useAnchorDir(ctx: Ctx, open: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  const env = useEnvironment()
  useIsoLayoutEffect(() => {
    if (!open) return
    const ids = popoverIds(ctx.root, ctx.scope)
    const anchor = env.dom.getById(ctx.anchorRendered ? ids.anchor : ids.trigger)
    const found = anchor?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.root, ctx.scope, ctx.anchorRendered, env])
  return dir
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = usePopover("Positioner")
  const open = useSelector(ctx.service, (v) => v.matches("open"))
  const dir = useAnchorDir(ctx, open)
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

export interface PopoverContentState {
  readonly open: boolean
}

function Content({
  render,
  ref,
  children,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...rest
}: Own<"div", PopoverContentState>) {
  const ctx = usePopover("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = useState(false)
  const [contentFocused, setContentFocused] = useState(false)
  const modality = useModality(env.modality, contentFocused)
  const { api, open } = useApi(ctx, { focusWithin, contentFocused, modality })
  const { node, mounted, state } = usePartPresence(ctx, open)
  const { setContentMounted } = ctx
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  // Focus within, from the DOM itself (as the Dialog: native events plus a frame check).
  useIsoLayoutEffect(() => {
    const el = node.current
    if (!mounted || !el) return
    const sync = () => {
      const active = el.ownerDocument.activeElement
      setFocusWithin(active !== null && el.contains(active))
      setContentFocused(active === el)
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && el.contains(next)) return
      setFocusWithin(false)
      setContentFocused(false)
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
  }, [mounted, env, node])
  if (!mounted) return null
  const exiting = !open && state === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content({ label, labelledBy, describedBy })),
      hidden: !open && !exiting && ctx.keepMounted,
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      // Headings inside the body are one level below the title; layers opened from here
      // are this popover's children.
      children: (
        <LayerProvider layer={popoverLayerId(ctx.root)} kind="popover">
          <Heading.Level level={Math.min(6, ctx.titleLevel + 1) as HeadingLevel}>
            {children}
          </Heading.Level>
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, { open })
}

function Arrow({ render, ...rest }: Own<"div">) {
  const ctx = usePopover("Arrow")
  const { api } = useApi(ctx)
  return renderPart("div", mergeProps(normalizeProps(api.arrow()), rest), render, undefined)
}

/** Registers a title/description part with the Root while it is mounted (React state). */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  const { setRendered } = ctx
  const id = partId(ctx.scope, ctx.root, part)
  useIsoLayoutEffect(() => {
    setRendered((r) => ({ ...r, [part]: id }))
    return () => setRendered((r) => ({ ...r, [part]: undefined }))
  }, [setRendered, part, id])
}

export type PopoverTitleProps = Own<"h2"> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel
}

function Title({ level = 2, render, ref, ...rest }: PopoverTitleProps) {
  const ctx = usePopover("Title")
  const { api } = useApi(ctx)
  useRegistered(ctx, "title")
  const { setTitleLevel } = ctx
  useIsoLayoutEffect(() => setTitleLevel(level), [level, setTitleLevel])
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(`h${level}`, render, el)
  const props = mergeProps(
    { ...normalizeProps(api.title({ level, tag })), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart(`h${level}`, props, render, undefined)
}

function Description({ render, ...rest }: Own<"p">) {
  const ctx = usePopover("Description")
  const { api } = useApi(ctx)
  useRegistered(ctx, "description")
  return renderPart("p", mergeProps(normalizeProps(api.description()), rest), render, undefined)
}

function CloseTrigger({ render, ref, ...rest }: Own<"button">) {
  const ctx = usePopover("CloseTrigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  // No content of its own (an icon): named by messages.close.
  const [empty, setEmpty] = useState(false)
  useIsoLayoutEffect(() => {
    setEmpty((el.current?.textContent ?? "").trim() === "")
  })
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressClose(e.modality)
    },
  })
  const own = normalizeProps(api.closeTrigger({ focused, modality, pressed: press.pressed, empty }))
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, undefined)
}

function Portal(props: PortalProps) {
  const ctx = usePopover("Portal")
  const env = useEnvironment()
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => env.dom.getById(popoverIds(ctx.root, ctx.scope).trigger)
  return <PortalPart logicalParent={logicalParent} {...props} />
}

/** Popover.Root with its parts re-scoped (`data-scope`), for composites (Date Picker): internal. */
export const ScopedPopoverRoot = Root

export const Popover = {
  // Public: no `scope` (a narrower parameter, so the same function is sound as this type).
  Root: Root as (props: PopoverRootProps) => ReturnType<typeof Root>,
  Trigger,
  Anchor,
  Indicator,
  Portal,
  Positioner,
  Content,
  Arrow,
  Title,
  Description,
  CloseTrigger,
}
