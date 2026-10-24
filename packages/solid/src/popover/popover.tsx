/** @jsxImportSource solid-js */
import {
  domPositioning,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
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
import { Dynamic } from "solid-js/web"
import { Heading } from "../heading"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    popover: PopoverMessages
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
type View = ReturnType<Service<typeof popoverMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof popoverMachine>
  readonly view: Accessor<View>
  readonly root: Accessor<string>
  readonly scope: Accessor<string>
  readonly props: Accessor<PopoverProps>
  readonly keepMounted: Accessor<boolean>
  readonly messages: Accessor<PopoverMessages>
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
  readonly anchorRendered: Accessor<boolean>
  readonly setAnchorRendered: (on: boolean) => void
  readonly titleLevel: Accessor<HeadingLevel>
  readonly setTitleLevel: (level: HeadingLevel) => void
  readonly rendered: Accessor<Rendered>
  readonly setRendered: (update: (r: Rendered) => Rendered) => void
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: Accessor<LayerMeta | undefined>
}

const PopoverContext = createContext<Ctx>()
function usePopover(part: string): Ctx {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error(`Popover.${part} must be inside Popover.Root`)
  return ctx
}

/**
 * For components composed on the Popover (Date Field's picker, Table's filters): the enclosing
 * Popover's open state and its machine's `send`, or null outside one. Not exported from the
 * package.
 */
export function usePopoverControls(): {
  readonly open: Accessor<boolean>
  readonly send: Service<typeof popoverMachine>["send"]
} | null {
  const ctx = useContext(PopoverContext)
  return ctx ? { open: () => ctx.view().matches("open"), send: ctx.service.send } : null
}

const isOpen = (ctx: Ctx) => ctx.view().matches("open")

interface Extra {
  dir?: "ltr" | "rtl" | undefined
  focusWithin?: boolean | undefined
  contentFocused?: boolean | undefined
  modality?: Parameters<typeof popoverConnect>[0]["modality"] | undefined
}

/** The connect output of a part (read in a computation). */
function useApi(ctx: Ctx, extra: Accessor<Extra> = () => ({})) {
  return createMemo(() => {
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
        rendered: ctx.rendered(),
        contentMounted: ctx.contentMounted(),
        anchorRendered: ctx.anchorRendered(),
        meta: ctx.meta(),
        manual: popoverPositioning(props).mode === "manual",
        ...extra(),
        messages: ctx.messages(),
      } as Parameters<typeof popoverConnect>[0],
      ctx.service.send,
    )
  })
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
  readonly id?: string | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<PopoverMessages> | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: PopoverActions) => void) | undefined
  /** The popover's parts: its trigger, anchor, portal, positioner and content. */
  readonly children?: JSX.Element
}

function Root(props: PopoverRootProps & Pick<PopoverProps, "scope">) {
  const [own, rest] = splitProps(props, ["id", "keepMounted", "messages", "actionsRef", "children"])
  const root = useRootId(() => own.id)
  const parent = useParentLayer()
  const messages = useMessages("popover", popoverMessages, () => own.messages)
  const env = useEnvironment()
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = { ...env, position: domPositioning(env) }
  const [anchorRendered, setAnchorRendered] = createSignal(false)
  const machineProps = (): PopoverProps =>
    ({ ...rest, root: root(), parent: parent(), anchored: anchorRendered() }) as PopoverProps
  const { view, send, service } = useMachine(popoverMachine, machineProps, withPosition)
  own.actionsRef?.({
    open: () => send({ type: "open" }),
    close: () => send({ type: "api", close: true }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
  })
  const [contentMounted, setContentMounted] = createSignal(false)
  const [titleLevel, setTitleLevel] = createSignal<HeadingLevel>(2)
  const [rendered, setRendered] = createSignal<Rendered>({})
  const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const open = view().matches("open")
      const id = root()
      setMeta(undefined)
      if (!open) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => setMeta(stack.get(popoverLayerId(id))?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  const ctx: Ctx = {
    service,
    view,
    root,
    scope: () => rest.scope ?? "popover",
    props: machineProps,
    keepMounted: () => own.keepMounted === true,
    messages,
    contentMounted,
    setContentMounted,
    anchorRendered,
    setAnchorRendered,
    titleLevel,
    setTitleLevel,
    rendered,
    setRendered,
    meta,
  }
  return <PopoverContext.Provider value={ctx}>{own.children}</PopoverContext.Provider>
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

export interface PopoverTriggerState {
  readonly open: boolean
}

export type PopoverTriggerProps = Own<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  PopoverTriggerState
>

/** Focus and modality of a button part, plus its press. */
function useButton(onPress: (modality: Modality) => void, disabled: () => boolean = () => false) {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  return {
    focused,
    modality,
    press,
    handlers: { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
  }
}

function Trigger(props: PopoverTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Trigger")
  const api = useApi(ctx)
  const b = useButton(
    (m) => untrack(api).pressTrigger(m),
    () => ctx.props().disabled === true,
  )
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const state = reactive<PopoverTriggerState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().trigger({
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              tag: tag(),
            }),
          ),
          b.press.props,
          b.handlers,
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Optional: positions the content against this element instead of the trigger. */
function Anchor(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Anchor")
  const api = useApi(ctx)
  createEffect(() => {
    ctx.setAnchorRendered(true)
    onCleanup(() => ctx.setAnchorRendered(false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(api().anchor()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Indicator(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Indicator")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().indicator()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useAnchorDir(ctx: Ctx) {
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  const env = useEnvironment()
  afterMount(() => {
    createEffect(() => {
      if (!isOpen(ctx)) return
      const ids = popoverIds(ctx.root(), ctx.scope())
      const anchor = env.dom.getById(ctx.anchorRendered() ? ids.anchor : ids.trigger)
      const found = anchor?.closest("[dir]")?.getAttribute("dir")
      setDir(found === "rtl" ? "rtl" : "ltr")
    })
  })
  return dir
}

function Positioner(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Positioner")
  const dir = useAnchorDir(ctx)
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

export interface PopoverContentState {
  readonly open: boolean
}

export type PopoverContentProps = Own<JSX.HTMLAttributes<HTMLDivElement>, PopoverContentState>

function Content(props: PopoverContentProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "children",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
  ])
  const ctx = usePopover("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = createSignal(false)
  const [contentFocused, setContentFocused] = createSignal(false)
  const modality = useModality(env.modality, contentFocused)
  const api = useApi(ctx, () => ({
    focusWithin: focusWithin(),
    contentFocused: contentFocused(),
    modality: modality(),
  }))
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, { keepMounted: ctx.keepMounted })
  afterMount(() => {
    createEffect(() => {
      const el = presence.mounted() ? node() : null
      ctx.setContentMounted(el !== null)
      if (!(el instanceof HTMLElement)) return
      onCleanup(() => ctx.setContentMounted(false))
      // Focus within, from the DOM itself (as the Dialog: native events plus a frame check).
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
      onCleanup(() => {
        env.scheduler.cancelAnimationFrame(frame)
        el.removeEventListener("focusin", sync)
        el.removeEventListener("focusout", onFocusOut)
      })
    })
  })
  const exiting = () => !isOpen(ctx) && presence.state() === "exiting"
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().content({
            label: local["aria-label"],
            labelledBy: local["aria-labelledby"],
            describedBy: local["aria-describedby"],
          }),
        ),
        hidden: !isOpen(ctx) && !exiting() && ctx.keepMounted(),
        ...(exiting() ? { inert: true } : {}),
        ref: setNode,
      },
      rest,
    ),
  )
  const state = reactive<PopoverContentState>(() => ({ open: isOpen(ctx) }))
  // The scroll lock writes this element's style too.
  const kept = keepStyle(merged)
  // Headings inside the body are one level below the title; layers opened from here are this
  // popover's children.
  const children = () => (
    <LayerProvider layer={popoverLayerId(ctx.root())} kind="popover">
      <Heading.Level level={Math.min(6, ctx.titleLevel() + 1) as HeadingLevel}>
        {local.children}
      </Heading.Level>
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

function Arrow(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Arrow")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().arrow()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  afterMount(() => {
    createEffect(() => {
      const id = partId(ctx.scope(), ctx.root(), part)
      ctx.setRendered((r) => ({ ...r, [part]: id }))
      onCleanup(() => ctx.setRendered((r) => ({ ...r, [part]: undefined })))
    })
  })
}

export type PopoverTitleProps = Own<JSX.HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel | undefined
}

function Title(props: PopoverTitleProps) {
  const [local, rest] = splitProps(props, ["level", "render", "children"])
  const ctx = usePopover("Title")
  const api = useApi(ctx)
  useRegistered(ctx, "title")
  const level = () => local.level ?? 2
  createEffect(() => ctx.setTitleLevel(level()))
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => `h${level()}`,
    () => local.render,
    el,
  )
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().title({ level: level(), tag: tag() })), ref: setEl },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <Dynamic component={`h${level()}`} {...p}>
      {children()}
    </Dynamic>
  ))
}

function Description(props: Own<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("Description")
  const api = useApi(ctx)
  useRegistered(ctx, "description")
  const merged = createMemo(() => mergeProps(normalizeProps(api().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <p {...p}>{children()}</p>)
}

function CloseTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePopover("CloseTrigger")
  const api = useApi(ctx)
  const b = useButton((m) => untrack(api).pressClose(m))
  const [el, setEl] = createSignal<Element | null>(null)
  // No content of its own (an icon): named by messages.close.
  const [empty, setEmpty] = createSignal(false)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (!node) return
      const read = () => setEmpty((node.textContent ?? "").trim() === "")
      read()
      const observer = new MutationObserver(read)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().closeTrigger({
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              empty: empty(),
            }),
          ),
          b.press.props,
          b.handlers,
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
function Portal(props: PortalProps) {
  const ctx = usePopover("Portal")
  const env = useEnvironment()
  const logicalParent = () => env.dom.getById(popoverIds(ctx.root(), ctx.scope()).trigger)
  return <PortalPart logicalParent={logicalParent} {...props} />
}

/** Popover.Root with its parts re-scoped (`data-scope`), for composites (Date Picker): internal. */
export const ScopedPopoverRoot = Root

// Public: no `scope` (a narrower parameter, so the same function is sound as this type).
const PublicRoot = Root as (props: PopoverRootProps) => ReturnType<typeof Root>

/** The parts, by name: `popover.parts.ts` re-exports them as the `Popover` namespace. */
export {
  Anchor,
  Arrow,
  CloseTrigger,
  Content,
  Description,
  Indicator,
  Portal,
  Positioner,
  PublicRoot as Root,
  Title,
  Trigger,
}
