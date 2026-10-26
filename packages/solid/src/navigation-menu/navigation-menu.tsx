/** @jsxImportSource solid-js */
import {
  contentSize,
  domHoverIntent,
  domPositioning,
  type HoverIntent,
  type MessageOverrides,
  type NavigationMenuLevel,
  type NavigationMenuMessages,
  type NavigationMenuProps,
  navigationMenuConnect,
  navigationMenuIds,
  navigationMenuLayerId,
  navigationMenuLevel,
  navigationMenuMachine,
  navigationMenuMessages,
  navigationMenuPositioning,
  type PositioningProps,
  type Service,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { insert } from "solid-js/web"
import { useFieldsetDisabled } from "../fieldset/context"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { Link, type LinkProps } from "../link/link"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"
import { useSelectionIndicator } from "../use-selection-indicator"

declare module "../provider" {
  interface RindMessageScopes {
    "navigation-menu": NavigationMenuMessages
  }
}

type Api = ReturnType<typeof navigationMenuConnect>

interface Positioned {
  readonly anchor: "trigger" | "list"
  readonly positioning?: PositioningProps | undefined
  /** One Positioner per item (around its Content), not one around the Viewport. */
  readonly perItem: boolean
}

interface Delays {
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
}

interface LevelCtx {
  readonly service: Service<typeof navigationMenuMachine>
  readonly root: Accessor<string>
  readonly api: Accessor<Api>
  readonly value: Accessor<string | null>
  readonly level: NavigationMenuLevel
  readonly orientation: Accessor<"horizontal" | "vertical">
  readonly closedContent: Accessor<"hidden" | "unmount">
  readonly disabled: Accessor<boolean>
  readonly hoverIntent: HoverIntent
  readonly items: Map<string, HTMLElement>
  readonly bumpItems: () => void
  readonly itemsVersion: Accessor<number>
  readonly disabledItems: Map<string, boolean>
  readonly viewport: Accessor<HTMLElement | null>
  readonly setViewport: (el: HTMLElement | null) => void
  /** Registers a Positioner: `slot` is its item's key, or `""` around the Viewport. */
  readonly registerPositioner: (slot: string, p: Positioned) => () => void
  readonly current: Accessor<ReadonlySet<string>>
  readonly markCurrent: (key: string, on: boolean) => void
  /** The delays a Sub level inherits. */
  readonly delays: Accessor<Delays>
}

/** A panel, and the panel it is nested in (a current link marks every ancestor trigger). */
interface PanelCtx {
  readonly item: Accessor<string>
  readonly level: LevelCtx
  readonly parent: PanelCtx | null
}

interface ItemCtx {
  /** The level the item belongs to (a Sub's Positioner is not its parent item's). */
  readonly root: string
  readonly key: Accessor<string>
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
}

const LevelContext = createContext<LevelCtx>()
const ItemContext = createContext<ItemCtx>()
/** Inside a panel: links and nested triggers move with ArrowDown / ArrowUp. */
const PanelContext = createContext<PanelCtx>()

function useLevel(part: string): LevelCtx {
  const ctx = useContext(LevelContext)
  if (!ctx) throw new Error(`NavigationMenu.${part} must be inside NavigationMenu.Root`)
  return ctx
}
function useItem(part: string): ItemCtx {
  const ctx = useContext(ItemContext)
  if (!ctx) throw new Error(`NavigationMenu.${part} must be inside NavigationMenu.Item`)
  return ctx
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Substitutes the rendered element without changing behaviour. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

/** A level's props: the root's and a Sub's. */
interface LevelProps {
  /** The open item's `value` (controlled); `null` when none is open. */
  readonly value?: string | null | undefined
  /** The item open at first (uncontrolled). */
  readonly defaultValue?: string | null | undefined
  /** Called when the open item changes; `details.reason` says why. */
  readonly onValueChange?: NavigationMenuProps["onValueChange"] | undefined
  /** `horizontal` (default for the root) or `vertical` (default for a Sub). */
  readonly orientation?: "horizontal" | "vertical" | undefined
}

interface LevelInput extends LevelProps {
  readonly id?: string | undefined
  readonly openOnHover?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
  readonly closedContent: "hidden" | "unmount"
  readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  readonly defaultOrientation: "horizontal" | "vertical"
}

/** One level's service and registries. */
function useLevelState(own: () => LevelInput, parent: LevelCtx | undefined): LevelCtx {
  const root = useRootId(() => own().id)
  const env = useEnvironment()
  const navEnv = { ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }
  const locale = useLocale(() => undefined)
  const messages = useMessages("navigation-menu", navigationMenuMessages, () => own().messages)
  const items = new Map<string, HTMLElement>()
  const [itemsVersion, setItemsVersion] = createSignal(0)
  const disabledItems = new Map<string, boolean>()
  const [viewport, setViewport] = createSignal<HTMLElement | null>(null)
  // Keyed per Positioner, so one item's Positioner unmounting leaves the others registered.
  const [positioners, setPositioners] = createSignal<ReadonlyMap<string, Positioned>>(new Map())
  const registerPositioner = (slot: string, p: Positioned) => {
    setPositioners((m) => new Map(m).set(slot, p))
    return () =>
      setPositioners((m) => {
        if (m.get(slot) !== p) return m
        const next = new Map(m)
        next.delete(slot)
        return next
      })
  }
  const [current, setCurrent] = createSignal<ReadonlySet<string>>(new Set())
  const markCurrent = (key: string, on: boolean) =>
    setCurrent((s) => {
      if (s.has(key) === on) return s
      const next = new Set(s)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  let service: Service<typeof navigationMenuMachine> | null = null
  const level = navigationMenuLevel(parent?.level ?? null, {
    close: () => service?.send({ type: "LINK.ACTIVATE" }),
    parentClose: () => service?.send({ type: "PARENT.CLOSE" }),
    openOnHover: () => own().openOnHover !== false,
  })
  if (parent) afterMount(() => onCleanup(parent.level.add(level)))
  const parentLayer = useParentLayer()
  const orientation = () => own().orientation ?? own().defaultOrientation
  // The open item's own Positioner, else the Viewport's, else any item's (a closed menu).
  // ponytail: read from the last value, so per-item `positioning` that differs between items
  // lags one switch; pass a per-key getter to the machine if that matters.
  let lastValue: string | null = null
  const positioner = (): Positioned | undefined =>
    positioners().get(lastValue ?? "") ??
    positioners().get("") ??
    positioners().values().next().value
  const machine = useMachine(
    navigationMenuMachine,
    () => {
      const o = own()
      const p = positioner()
      return {
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: o.onValueChange,
        openOnHover: level.openOnHover(),
        disabled: o.disabled,
        openDelay: o.openDelay,
        closeDelay: o.closeDelay,
        skipDelay: o.skipDelay,
        patientClick: o.patientClick,
        orientation: orientation(),
        root: root(),
        parent: parentLayer(),
        level,
        isItemDisabled: (key: string) => disabledItems.get(key) === true,
        positioned:
          p === undefined ? undefined : p.perItem ? ("item" as const) : ("level" as const),
        anchor: p?.anchor,
        positioning: p?.positioning,
      }
    },
    navEnv,
  )
  service = machine.service
  const value = createMemo(() => {
    const v = (machine.view().values.value as string | null | undefined) ?? null
    lastValue = v
    return v
  })
  const api = createMemo(() => {
    const v = value()
    itemsVersion()
    // Item order for the motion direction: document order of the registered items.
    const order = [...items.entries()]
      .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
      .map(([k]) => k)
    const view = machine.view()
    return navigationMenuConnect(
      {
        instance: root(),
        value: v,
        previous: view.context.previous,
        order,
        orientation: orientation(),
        dir: locale().dir,
        instant: view.context.instant,
        placement: view.context.placement,
        indicator: view.context.indicator,
        manual:
          navigationMenuPositioning({ positioning: positioner()?.positioning }).mode === "manual",
        messages: messages(),
      },
      machine.service.send,
    )
  })
  return {
    service: machine.service,
    root,
    api,
    value,
    level,
    orientation,
    closedContent: () => own().closedContent,
    disabled: () => own().disabled === true,
    hoverIntent: navEnv.hoverIntent,
    items,
    bumpItems: () => setItemsVersion((n) => n + 1),
    itemsVersion,
    disabledItems,
    viewport,
    setViewport,
    registerPositioner,
    current,
    markCurrent,
    delays: () => ({
      openDelay: own().openDelay,
      closeDelay: own().closeDelay,
      skipDelay: own().skipDelay,
      patientClick: own().patientClick,
    }),
  }
}

export type NavigationMenuRootProps = Omit<Own<JSX.HTMLAttributes<HTMLElement>>, "id"> &
  LevelProps & {
    readonly id?: string | undefined
    /** Open items when a mouse or pen rests on their trigger (default true). */
    readonly openOnHover?: boolean | undefined
    /** Disables every trigger. */
    readonly disabled?: boolean | undefined
    /** Hover time before an item opens, in ms (default 200). */
    readonly openDelay?: number | undefined
    /** Time before a hover-opened panel closes after the pointer left, in ms (default 300). */
    readonly closeDelay?: number | undefined
    /** After a close, hovering a trigger within this time opens it at once, in ms (default 300). */
    readonly skipDelay?: number | undefined
    /** A press this soon after a hover open keeps the panel open, in ms (default 500). */
    readonly patientClick?: number | undefined
    /**
     * Closed panels: `hidden` (default) keeps them in the document with `hidden`, so their
     * links are crawlable and found by find-in-page indexing; `unmount` removes them after
     * their exit animation.
     */
    readonly closedContent?: "hidden" | "unmount" | undefined
    /** The landmark's default name (`label`, "Main"). */
    readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  }

/** The `navigation` landmark and its root level. */
function Root(props: NavigationMenuRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "orientation",
    "openOnHover",
    "disabled",
    "openDelay",
    "closeDelay",
    "skipDelay",
    "patientClick",
    "closedContent",
    "messages",
    "id",
    "render",
    "children",
  ])
  const ctx = useLevelState(
    () => ({
      value: local.value,
      defaultValue: local.defaultValue,
      onValueChange: local.onValueChange,
      orientation: local.orientation,
      openOnHover: local.openOnHover,
      disabled: local.disabled,
      openDelay: local.openDelay,
      closeDelay: local.closeDelay,
      skipDelay: local.skipDelay,
      patientClick: local.patientClick,
      closedContent: local.closedContent ?? "hidden",
      messages: local.messages,
      id: local.id,
      defaultOrientation: "horizontal",
    }),
    undefined,
  )
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().root({ labelledBy: rest["aria-labelledby"] })), rest),
  )
  const children = () => local.children
  return (
    <LevelContext.Provider value={ctx}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <nav {...p}>{children()}</nav>
      ))}
    </LevelContext.Provider>
  )
}

export type NavigationMenuSubProps = Omit<Own<JSX.HTMLAttributes<HTMLDivElement>>, "id"> &
  LevelProps & { readonly id?: string | undefined }

/** A nested level inside a Content: its own List, items and value; not a landmark. */
function Sub(props: NavigationMenuSubProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "orientation",
    "id",
    "render",
    "children",
  ])
  const parent = useLevel("Sub")
  const ctx = useLevelState(
    () => ({
      value: local.value,
      defaultValue: local.defaultValue,
      onValueChange: local.onValueChange,
      orientation: local.orientation,
      disabled: parent.disabled(),
      ...parent.delays(),
      closedContent: parent.closedContent(),
      id: local.id,
      defaultOrientation: "vertical",
    }),
    parent,
  )
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().sub()), rest))
  const children = () => local.children
  return (
    <LevelContext.Provider value={ctx}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </LevelContext.Provider>
  )
}

/** The level's items. */
function List(props: Own<JSX.HTMLAttributes<HTMLUListElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("List")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().list()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <ul {...p}>{children()}</ul>)
}

export type NavigationMenuItemProps = Own<JSX.HTMLAttributes<HTMLLIElement>> & {
  /** The item's key in the level's `value` (default: a generated, SSR-stable key). */
  readonly value?: string | undefined
}

/** One item: a Link, a Trigger with its Content, or both (a split item). */
function Item(props: NavigationMenuItemProps) {
  const [local, rest] = splitProps(props, ["value", "render", "children"])
  const ctx = useLevel("Item")
  // Digits only, prefixed: the shape the cross-framework markup comparison reads as a
  // generated key (testing's canonical HTML), as React's and Vue's ids are.
  const generated = `c${createUniqueId().replace(/\D/g, "")}`
  const key = createMemo(() => local.value ?? generated)
  const [el, setEl] = createSignal<Element | null>(null)
  const [contentMounted, setContentMounted] = createSignal(false)
  // Registered after the render, never during it.
  createEffect(() => {
    const node = el()
    const k = key()
    if (!(node instanceof HTMLElement)) return
    ctx.items.set(k, node)
    ctx.bumpItems()
    onCleanup(() => {
      ctx.items.delete(k)
      ctx.bumpItems()
    })
  })
  const item: ItemCtx = { root: untrack(ctx.root), key, contentMounted, setContentMounted }
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().item(key())), ref: setEl }, rest),
  )
  const children = () => local.children
  return (
    <ItemContext.Provider value={item}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

export interface NavigationMenuTriggerState {
  /** Its panel is open. */
  readonly open: boolean
}

export type NavigationMenuTriggerProps = Own<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  NavigationMenuTriggerState
> & {
  /** Never opens by press, keyboard or hover. */
  readonly disabled?: boolean | undefined
}

/** The disclosure button that toggles the item's panel. */
function Trigger(props: NavigationMenuTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "disabled", "children"])
  const ctx = useLevel("Trigger")
  const item = useItem("Trigger")
  const panel = useContext(PanelContext)
  const env = useEnvironment()
  // rind's Fieldset and a native <fieldset disabled> disable it too (button-like-element).
  const fieldsetDisabled = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const disabled = () =>
    local.disabled === true || ctx.disabled() || fieldsetDisabled() || fieldsetDom()
  const open = () => ctx.value() === item.key()
  createEffect(() => {
    const k = item.key()
    const d = disabled()
    ctx.disabledItems.set(k, d)
    if (d) ctx.service.send({ type: "DISABLED" })
    onCleanup(() => {
      ctx.disabledItems.delete(k)
    })
  })
  // The modality tracker needs a subscriber while the trigger is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") untrack(ctx.api).press(untrack(item.key), e.modality)
    },
    disabled,
  })
  const hover = useHover({ env, disabled, send: () => {} })
  // Stable for the trigger's life: the handlers remember whether the pointer is on it.
  const intent = ctx.hoverIntent.triggerProps((e) =>
    ctx.service.send({ type: e.type, item: untrack(item.key) }),
  )
  const [el, setEl] = createSignal<Element | null>(null)
  createEffect(() => {
    const node = el()
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    onCleanup(watch.stop)
  })
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const state = reactive<NavigationMenuTriggerState>(() => ({ open: open() }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api().trigger(item.key(), {
              focused: focused(),
              modality: modality(),
              pressed: press.pressed(),
              hovered: hover.hovered(),
              tag: tag(),
              disabled: disabled(),
              current: ctx.current().has(item.key()),
              contentMounted: item.contentMounted(),
              inPanel: panel !== undefined,
            }),
          ),
          press.props,
          hover.props,
          {
            onPointerMove: intent.onPointerMove,
            onPointerLeave: intent.onPointerLeave,
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          },
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

/** Content size properties, after the update that changed `open` (collapsible's sequence). */
function useSizeSequence(
  el: Accessor<Element | null>,
  value: Accessor<string | null>,
  part: "content" | "viewport",
  enabled: Accessor<boolean>,
) {
  let size: { node: HTMLElement; s: ReturnType<typeof contentSize> } | null = null
  let last: string | null | undefined
  afterMount(() => {
    createEffect(() => {
      const node = el()
      const v = value()
      const on = enabled()
      const prev = last
      if (prev === v) return
      last = v
      if (!(node instanceof HTMLElement) || !on) return
      if (size?.node !== node) size = { node, s: contentSize(node, "rind-navigation-menu", part) }
      const s = size.s
      if (v === null) {
        if (prev !== undefined && prev !== null) s.closed()
        return
      }
      if (prev === undefined) return s.opened({ instant: true })
      if (prev === null) s.opened({ instant: false })
      else s.switched()
      // Settled once the enter animations finished (or at once when nothing animates).
      const running = node.getAnimations?.({ subtree: true }) ?? []
      let live = true
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (live) s.settled()
      })
      onCleanup(() => {
        live = false
      })
    })
  })
}

/** Renders `children` into `target` (the Viewport), keeping the owner's context. */
function Into(props: { readonly target: HTMLElement; readonly make: () => JSX.Element }) {
  createEffect(() => {
    const target = props.target
    const start = document.createTextNode("")
    const end = document.createTextNode("")
    target.append(start, end)
    untrack(() => insert(target, props.make(), end))
    onCleanup(() => {
      while (start.nextSibling && start.nextSibling !== end) start.nextSibling.remove()
      start.remove()
      end.remove()
    })
  })
  return null
}

export interface NavigationMenuContentState {
  /** The panel is open. */
  readonly open: boolean
}

export type NavigationMenuContentProps = Own<
  JSX.HTMLAttributes<HTMLDivElement>,
  NavigationMenuContentState
>

/** The item's panel: in place, or inside the level's Viewport when one is rendered. */
function Content(props: NavigationMenuContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Content")
  const item = useItem("Content")
  const open = () => ctx.value() === item.key()
  const [el, setEl] = createSignal<Element | null>(null)
  const presence = usePresence(open, el)
  const inViewport = () => ctx.viewport() !== null
  // In a shared viewport the outgoing panel goes at once: the viewport animates the switch.
  const switchedAway = () => inViewport() && ctx.value() !== null && !open()
  const exiting = () => !open() && !switchedAway() && presence.state() === "exiting"
  const mounted = createMemo(() => ctx.closedContent() === "hidden" || open() || exiting())
  createEffect(() => {
    if (!mounted()) return
    item.setContentMounted(true)
    onCleanup(() => item.setContentMounted(false))
  })
  useSizeSequence(
    el,
    () => (open() ? item.key() : null),
    "content",
    () => !inViewport(),
  )
  const parentPanel = useContext(PanelContext) ?? null
  const panel: PanelCtx = { item: item.key, level: ctx, parent: parentPanel }
  const state = reactive<NavigationMenuContentState>(() => ({ open: open() }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().content(item.key())),
        hidden: !open() && !exiting() ? true : undefined,
        ...(exiting() ? { inert: true } : {}),
        ref: setEl,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  // Layers opened from a panel (a nested level, a dialog) are this level's children.
  const children = () => (
    <LayerProvider layer={navigationMenuLayerId(ctx.root())} kind="popover">
      <PanelContext.Provider value={panel}>{local.children}</PanelContext.Provider>
    </LayerProvider>
  )
  const body = () =>
    untrack(() =>
      renderPart(local.render, kept, state, children, (p) => <div {...p}>{children()}</div>),
    )
  return (
    <Show when={mounted()}>
      <Show when={ctx.viewport()} fallback={untrack(body)}>
        {(viewport) => <Into target={viewport()} make={body} />}
      </Show>
    </Show>
  )
}

export type NavigationMenuLinkProps = LinkProps

/** A link: `current` marks the page; a same-tab activation closes every open level. */
function NavLink(props: NavigationMenuLinkProps) {
  const [local, rest] = splitProps(props, ["onActivate", "current"])
  const ctx = useLevel("Link")
  const panel = useContext(PanelContext)
  const on = () => local.current !== undefined && local.current !== false
  // The current page marks the trigger of every panel the link is in, outermost included.
  const chain: { readonly item: Accessor<string>; readonly mark: LevelCtx["markCurrent"] }[] = []
  for (let p: PanelCtx | null | undefined = panel; p; p = p.parent)
    chain.push({ item: p.item, mark: p.level.markCurrent })
  createEffect(() => {
    if (!on()) return
    const marked = chain.map((c) => ({ item: c.item(), mark: c.mark }))
    for (const c of marked) c.mark(c.item, true)
    onCleanup(() => {
      for (const c of marked) c.mark(c.item, false)
    })
  })
  // Arrow keys find the link by its id.
  const generated = createUniqueId()
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().link({ inPanel: panel !== undefined })),
        id: `${ctx.root()}-link-${generated}`,
      },
      rest,
    ),
  )
  return (
    <Link
      {...(merged() as LinkProps)}
      current={local.current}
      onActivate={(details) => {
        local.onActivate?.(details)
        if (details.disposition === "same-tab") ctx.level.closeTree()
      }}
    />
  )
}

/** Decorative: the open trigger's box, inside List. */
function Indicator(props: Own<JSX.HTMLAttributes<HTMLLIElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Indicator")
  const [el, setEl] = createSignal<Element | null>(null)
  useSelectionIndicator({
    el,
    selectedId: () => {
      const v = ctx.value()
      return v === null ? null : navigationMenuIds(ctx.root()).trigger(v)
    },
    itemSelector: '[data-scope="navigation-menu"][data-part="trigger"]',
    collection: ctx.itemsVersion,
    onMeasure: (box, cause) => ctx.service.send({ type: "INDICATOR.MEASURE", box, cause }),
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().indicator()), ref: setEl }, rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <li {...p}>{children()}</li>)
}

/** The shared panel the open content renders into, sized by the size properties. */
function Viewport(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Viewport")
  const [el, setEl] = createSignal<Element | null>(null)
  const open = () => ctx.value() !== null
  const presence = usePresence(open, el, { subtree: () => true })
  const exiting = () => !open() && presence.state() === "exiting"
  createEffect(() => {
    const node = el()
    ctx.setViewport(node instanceof HTMLElement ? node : null)
    onCleanup(() => ctx.setViewport(null))
  })
  useSizeSequence(el, ctx.value, "viewport", () => true)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().viewport()),
        hidden: !open() && !exiting() ? true : undefined,
        ref: setEl,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  return renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>)
}

export type NavigationMenuPositionerProps = Own<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** What the panel is placed against: the open trigger (default) or the whole list. */
  readonly anchor?: "trigger" | "list" | undefined
  /** Side, alignment and offsets (default below, aligned to the start, 4 px away). */
  readonly positioning?: PositioningProps | undefined
}

/**
 * Places the Viewport next to the open trigger; inside an Item (no Viewport), places that
 * item's Content next to its own trigger.
 */
function Positioner(props: NavigationMenuPositionerProps) {
  const [local, rest] = splitProps(props, ["anchor", "positioning", "render", "children"])
  const ctx = useLevel("Positioner")
  const inItem = useContext(ItemContext)
  // An item of this level (a Sub's Positioner sits in its parent's item, not its own).
  const item = () => (inItem?.root === untrack(ctx.root) ? inItem.key() : undefined)
  const [el, setEl] = createSignal<Element | null>(null)
  const open = () => (item() === undefined ? ctx.value() !== null : ctx.value() === item())
  const presence = usePresence(open, el, { subtree: () => true })
  const exiting = () => !open() && presence.state() === "exiting"
  const positioningKey = createMemo(() => JSON.stringify(local.positioning ?? null))
  createEffect(() => {
    const anchor = local.anchor ?? "trigger"
    const slot = item()
    positioningKey()
    const positioning = untrack(() => local.positioning)
    onCleanup(
      ctx.registerPositioner(slot ?? "", { anchor, positioning, perItem: slot !== undefined }),
    )
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().positioner(item())),
        hidden: !open() && !exiting() ? true : undefined,
        ref: setEl,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  return renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>)
}

/** The parts, by name: `navigation-menu.parts.ts` re-exports them as the `NavigationMenu` namespace. */
export { Content, Indicator, Item, List, NavLink as Link, Positioner, Root, Sub, Trigger, Viewport }
