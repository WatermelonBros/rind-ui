"use client"

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
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { Link, type LinkProps } from "../link/link"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type Api = ReturnType<typeof navigationMenuConnect>

interface LevelCtx {
  readonly service: Service<typeof navigationMenuMachine>
  readonly root: string
  readonly api: Api
  readonly value: string | null
  readonly level: NavigationMenuLevel
  readonly orientation: "horizontal" | "vertical"
  readonly closedContent: "hidden" | "unmount"
  readonly disabled: boolean
  readonly hoverIntent: HoverIntent
  readonly items: Map<string, HTMLElement>
  readonly disabledItems: Map<string, boolean>
  readonly viewport: HTMLElement | null
  readonly setViewport: (el: HTMLElement | null) => void
  readonly viewportExiting: boolean
  readonly setViewportExiting: (on: boolean) => void
  /** Registers a Positioner: `slot` is its item's key, or `""` around the Viewport. */
  readonly registerPositioner: (slot: string, p: Positioned) => () => void
  readonly current: ReadonlySet<string>
  readonly markCurrent: (key: string, on: boolean) => void
  readonly triggerOf: () => HTMLElement | null
  /** The delays a Sub level inherits. */
  readonly delays: Delays
}

interface Delays {
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
}

interface Positioned {
  readonly anchor: "trigger" | "list"
  readonly positioning?: PositioningProps | undefined
  /** One Positioner per item (around its Content), not one around the Viewport. */
  readonly perItem: boolean
}

const LevelContext = createContext<LevelCtx | null>(null)
const ItemContext = createContext<ItemCtx | null>(null)
/** Inside a panel: links and nested triggers move with ArrowDown / ArrowUp. */
const PanelContext = createContext<PanelCtx | null>(null)

/** A panel, and the panel it is nested in (a current link marks every ancestor trigger). */
interface PanelCtx {
  readonly item: string
  readonly level: LevelCtx
  readonly parent: PanelCtx | null
}

interface ItemCtx {
  /** The level the item belongs to (a Sub's Positioner is not its parent item's). */
  readonly root: string
  readonly key: string
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
}

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

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  /** Substitutes the rendered element without changing behaviour. */
  readonly render?: RenderProp<S>
}

/** A level's props: the root's and a Sub's. */
interface LevelProps {
  /** The open item's `value` (controlled); `null` when none is open. */
  readonly value?: string | null
  /** The item open at first (uncontrolled). */
  readonly defaultValue?: string | null
  /** Called when the open item changes; `details.reason` says why. */
  readonly onValueChange?: NavigationMenuProps["onValueChange"]
  /** `horizontal` (default for the root) or `vertical` (default for a Sub). */
  readonly orientation?: "horizontal" | "vertical"
}

function useLevelState(
  own: { readonly [K in keyof LevelProps]?: LevelProps[K] | undefined } & {
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
  },
  parent: LevelCtx | null,
): LevelCtx {
  const root = useRootId(own.id)
  const env = useEnvironment()
  const navEnv = useMemo(
    () => ({ ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }),
    [env],
  )
  const { dir } = useLocale()
  const messages = useMessages("navigation-menu", navigationMenuMessages, own.messages)
  const items = useRef(new Map<string, HTMLElement>()).current
  const disabledItems = useRef(new Map<string, boolean>()).current
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [viewportExiting, setViewportExiting] = useState(false)
  // Keyed per Positioner, so one item's Positioner unmounting leaves the others registered.
  const [positioners, setPositioners] = useState<ReadonlyMap<string, Positioned>>(() => new Map())
  const registerPositioner = useCallback((slot: string, p: Positioned) => {
    setPositioners((m) => new Map(m).set(slot, p))
    return () =>
      setPositioners((m) => {
        if (m.get(slot) !== p) return m
        const next = new Map(m)
        next.delete(slot)
        return next
      })
  }, [])
  const [current, setCurrent] = useState<ReadonlySet<string>>(() => new Set())
  const markCurrent = useCallback(
    (key: string, on: boolean) =>
      setCurrent((s) => {
        if (s.has(key) === on) return s
        const next = new Set(s)
        if (on) next.add(key)
        else next.delete(key)
        return next
      }),
    [],
  )
  const latestHover = useRef(own.openOnHover)
  latestHover.current = own.openOnHover
  const serviceRef = useRef<Service<typeof navigationMenuMachine> | null>(null)
  const [level] = useState(() =>
    navigationMenuLevel(parent?.level ?? null, {
      close: () => serviceRef.current?.send({ type: "LINK.ACTIVATE" }),
      parentClose: () => serviceRef.current?.send({ type: "PARENT.CLOSE" }),
      openOnHover: () => latestHover.current !== false,
    }),
  )
  useEffect(() => parent?.level.add(level), [parent, level])
  const orientation = own.orientation ?? own.defaultOrientation
  // The open item's own Positioner, else the Viewport's, else any item's (a closed menu).
  // ponytail: read from the last render's value, so per-item `positioning` that differs
  // between items lags one switch; pass a per-key getter to the machine if that matters.
  const lastValue = useRef<string | null>(null)
  const positioner: Positioned | undefined =
    positioners.get(lastValue.current ?? "") ??
    positioners.get("") ??
    positioners.values().next().value
  const props: NavigationMenuProps = {
    value: own.value,
    defaultValue: own.defaultValue,
    onValueChange: own.onValueChange,
    openOnHover: level.openOnHover(),
    disabled: own.disabled,
    openDelay: own.openDelay,
    closeDelay: own.closeDelay,
    skipDelay: own.skipDelay,
    patientClick: own.patientClick,
    orientation,
    root,
    parent: useParentLayer(),
    level,
    isItemDisabled: (key) => disabledItems.get(key) === true,
    positioned: positioner === undefined ? undefined : positioner.perItem ? "item" : "level",
    anchor: positioner?.anchor,
    positioning: positioner?.positioning,
  }
  const { view, service } = useMachine(navigationMenuMachine, props, navEnv)
  serviceRef.current = service
  const value = (view.values.value as string | null | undefined) ?? null
  lastValue.current = value
  // Item order for the motion direction: document order of the registered items.
  const order = [...items.entries()]
    .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
    .map(([k]) => k)
  const api = navigationMenuConnect(
    {
      instance: root,
      value,
      previous: view.context.previous,
      order,
      orientation,
      dir,
      instant: view.context.instant,
      placement: view.context.placement,
      indicator: view.context.indicator,
      manual: navigationMenuPositioning({ positioning: positioner?.positioning }).mode === "manual",
      messages,
    },
    service.send,
  )
  const ids = navigationMenuIds(root)
  return {
    service,
    root,
    api,
    value,
    level,
    orientation,
    closedContent: own.closedContent,
    disabled: own.disabled === true,
    hoverIntent: navEnv.hoverIntent,
    items,
    disabledItems,
    viewport,
    setViewport,
    viewportExiting,
    setViewportExiting,
    registerPositioner,
    current,
    markCurrent,
    triggerOf: () => (value === null ? null : env.dom.getById(ids.trigger(value))),
    delays: {
      openDelay: own.openDelay,
      closeDelay: own.closeDelay,
      skipDelay: own.skipDelay,
      patientClick: own.patientClick,
    },
  }
}

export type NavigationMenuRootProps = Omit<Own<"nav">, "defaultValue"> &
  LevelProps & {
    /** Open items when a mouse or pen rests on their trigger (default true). */
    readonly openOnHover?: boolean
    /** Disables every trigger. */
    readonly disabled?: boolean
    /** Hover time before an item opens, in ms (default 200). */
    readonly openDelay?: number
    /** Time before a hover-opened panel closes after the pointer left, in ms (default 300). */
    readonly closeDelay?: number
    /** After a close, hovering a trigger within this time opens it at once, in ms (default 300). */
    readonly skipDelay?: number
    /** A press this soon after a hover open keeps the panel open, in ms (default 500). */
    readonly patientClick?: number
    /**
     * Closed panels: `hidden` (default) keeps them in the document with `hidden`, so their
     * links are crawlable and found by find-in-page indexing; `unmount` removes them after
     * their exit animation.
     */
    readonly closedContent?: "hidden" | "unmount"
    /** The landmark's default name (`label`, "Main"). */
    readonly messages?: MessageOverrides<NavigationMenuMessages>
  }

/** The `navigation` landmark and its root level. */
function Root({
  value,
  defaultValue,
  onValueChange,
  orientation,
  openOnHover,
  disabled,
  openDelay,
  closeDelay,
  skipDelay,
  patientClick,
  closedContent = "hidden",
  messages,
  id,
  render,
  children,
  ...rest
}: NavigationMenuRootProps) {
  const ctx = useLevelState(
    {
      value,
      defaultValue,
      onValueChange,
      orientation,
      openOnHover,
      disabled,
      openDelay,
      closeDelay,
      skipDelay,
      patientClick,
      closedContent,
      messages,
      id,
      defaultOrientation: "horizontal",
    },
    null,
  )
  const labelledBy = rest["aria-labelledby"]
  const props = mergeProps(normalizeProps(ctx.api.root({ labelledBy })), { ...rest, children })
  return <LevelContext value={ctx}>{renderPart("nav", props, render, undefined)}</LevelContext>
}

export type NavigationMenuSubProps = Omit<Own<"div">, "defaultValue"> & LevelProps

/** A nested level inside a Content: its own List, items and value; not a landmark. */
function Sub({
  value,
  defaultValue,
  onValueChange,
  orientation,
  id,
  render,
  children,
  ...rest
}: NavigationMenuSubProps) {
  const parent = useLevel("Sub")
  const ctx = useLevelState(
    {
      value,
      defaultValue,
      onValueChange,
      orientation,
      disabled: parent.disabled,
      ...parent.delays,
      closedContent: parent.closedContent,
      id,
      defaultOrientation: "vertical",
    },
    parent,
  )
  const props = mergeProps(normalizeProps(ctx.api.sub()), { ...rest, children })
  return <LevelContext value={ctx}>{renderPart("div", props, render, undefined)}</LevelContext>
}

/** The level's items. */
function List({ render, ...rest }: Own<"ul">) {
  const ctx = useLevel("List")
  return renderPart("ul", mergeProps(normalizeProps(ctx.api.list()), rest), render, undefined)
}

export type NavigationMenuItemProps = Own<"li"> & {
  /** The item's key in the level's `value` (default: a generated, SSR-stable key). */
  readonly value?: string
}

/** One item: a Link, a Trigger with its Content, or both (a split item). */
function Item({ value, render, ref, ...rest }: NavigationMenuItemProps) {
  const ctx = useLevel("Item")
  const generated = useId()
  const key = value ?? generated
  const el = useRef<HTMLElement | null>(null)
  const [contentMounted, setContentMounted] = useState(false)
  // Registered after commit, never during render.
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    ctx.items.set(key, node)
    return () => {
      ctx.items.delete(key)
    }
  }, [ctx.items, key])
  const item = useMemo(
    () => ({ root: ctx.root, key, contentMounted, setContentMounted }),
    [ctx.root, key, contentMounted],
  )
  const props = mergeProps(
    { ...normalizeProps(ctx.api.item(key)), ref: composeRefs(el, ref) },
    rest,
  )
  return <ItemContext value={item}>{renderPart("li", props, render, undefined)}</ItemContext>
}

export interface NavigationMenuTriggerState {
  /** Its panel is open. */
  readonly open: boolean
}

export type NavigationMenuTriggerProps = Own<"button", NavigationMenuTriggerState> & {
  /** Never opens by press, keyboard or hover. */
  readonly disabled?: boolean
}

/** The disclosure button that toggles the item's panel. */
function Trigger({ render, ref, disabled: own = false, ...rest }: NavigationMenuTriggerProps) {
  const ctx = useLevel("Trigger")
  const item = useItem("Trigger")
  const panel = useContext(PanelContext)
  const env = useEnvironment()
  const disabled = own || ctx.disabled
  const open = ctx.value === item.key
  useIsoLayoutEffect(() => {
    ctx.disabledItems.set(item.key, disabled)
    if (disabled) ctx.service.send({ type: "DISABLED" })
    return () => {
      ctx.disabledItems.delete(item.key)
    }
  }, [disabled, item.key, ctx.disabledItems, ctx.service])
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.api.press(item.key, e.modality)
    },
    disabled: () => disabled,
  })
  const hover = useHover({ env, disabled: () => disabled, send: () => {} })
  const { api, service, hoverIntent } = ctx
  // Stable for the trigger's life: the handlers remember whether the pointer is on it.
  const intent = useMemo(
    () => hoverIntent.triggerProps((e) => service.send({ type: e.type, item: item.key })),
    [hoverIntent, service, item.key],
  )
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const own_ = normalizeProps(
    api.trigger(item.key, {
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
      tag,
      disabled,
      current: ctx.current.has(item.key),
      contentMounted: item.contentMounted,
      inPanel: panel !== null,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own_, press.props, hover.props, {
        onPointerMove: intent.onPointerMove,
        onPointerLeave: intent.onPointerLeave,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open })
}

/** Content size properties, after the commit that changed `open` (collapsible's sequence). */
function useSizeSequence(
  el: RefObject<HTMLElement | null>,
  value: string | null,
  part: "content" | "viewport",
  enabled: boolean,
) {
  const size = useRef<{ node: HTMLElement; s: ReturnType<typeof contentSize> } | null>(null)
  const last = useRef<string | null | undefined>(undefined)
  useIsoLayoutEffect(() => {
    const node = el.current
    const prev = last.current
    if (prev === value) return
    last.current = value
    if (!node || !enabled) return
    if (size.current?.node !== node)
      size.current = { node, s: contentSize(node, "rind-navigation-menu", part) }
    const s = size.current.s
    if (value === null) {
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
    return () => {
      live = false
    }
  }, [value, enabled])
}

export interface NavigationMenuContentState {
  /** The panel is open. */
  readonly open: boolean
}

/** The item's panel: in place, or inside the level's Viewport when one is rendered. */
function Content({ render, ref, children, ...rest }: Own<"div", NavigationMenuContentState>) {
  const ctx = useLevel("Content")
  const item = useItem("Content")
  const open = ctx.value === item.key
  const el = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, el)
  const inViewport = ctx.viewport !== null
  // In a shared viewport the outgoing panel goes at once: the viewport animates the switch.
  const switchedAway = inViewport && ctx.value !== null && !open
  const exiting = !open && !switchedAway && presence.state === "exiting"
  const mounted = ctx.closedContent === "hidden" || open || exiting
  const { setContentMounted } = item
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  useSizeSequence(el, open ? item.key : null, "content", !inViewport)
  const parentPanel = useContext(PanelContext)
  const panel = useMemo(
    () => ({ item: item.key, level: ctx, parent: parentPanel }),
    [item.key, ctx, parentPanel],
  )
  if (!mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(ctx.api.content(item.key)),
      hidden: !open && !exiting ? true : undefined,
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(el, ref),
    },
    {
      ...rest,
      // Layers opened from a panel (a nested level, a dialog) are this level's children.
      children: (
        <LayerProvider layer={navigationMenuLayerId(ctx.root)} kind="popover">
          <PanelContext value={panel}>{children}</PanelContext>
        </LayerProvider>
      ),
    },
  )
  const element = renderPart("div", props, render, { open })
  return ctx.viewport ? createPortal(element, ctx.viewport) : element
}

export type NavigationMenuLinkProps = LinkProps

/** A link: `current` marks the page; a same-tab activation closes every open level. */
function NavLink({ onActivate, current, ...rest }: NavigationMenuLinkProps) {
  const ctx = useLevel("Link")
  const panel = useContext(PanelContext)
  const on = current !== undefined && current !== false
  // The current page marks the trigger of every panel the link is in, outermost included.
  // Keyed by the chain's identity (its items), not by the per-render panel objects.
  const chain: { readonly item: string; readonly mark: LevelCtx["markCurrent"] }[] = []
  for (let p = panel; p; p = p.parent) chain.push({ item: p.item, mark: p.level.markCurrent })
  const chainKey = chain.map((c) => c.item).join(" ")
  const latestChain = useRef(chain)
  latestChain.current = chain
  useIsoLayoutEffect(() => {
    if (!on) return
    const marked = latestChain.current
    for (const c of marked) c.mark(c.item, true)
    return () => {
      for (const c of marked) c.mark(c.item, false)
    }
  }, [chainKey, on])
  // Arrow keys find the link by its id.
  const generated = useId()
  const own = normalizeProps(ctx.api.link({ inPanel: panel !== null }))
  const props = mergeProps({ ...own, id: `${ctx.root}-link-${generated}` }, rest) as LinkProps
  return (
    <Link
      {...props}
      {...(current === undefined ? {} : { current })}
      onActivate={(details) => {
        onActivate?.(details)
        if (details.disposition === "same-tab") ctx.level.closeTree()
      }}
    />
  )
}

/** Decorative: the open trigger's box, inside List. */
function Indicator({ render, ref, ...rest }: Own<"li">) {
  const ctx = useLevel("Indicator")
  const el = useRef<HTMLElement | null>(null)
  const ids = navigationMenuIds(ctx.root)
  const { service } = ctx
  useSelectionIndicator({
    el,
    selectedId: ctx.value === null ? null : ids.trigger(ctx.value),
    itemSelector: '[data-scope="navigation-menu"][data-part="trigger"]',
    collection: ctx.items.size,
    onMeasure: (box, cause) => service.send({ type: "INDICATOR.MEASURE", box, cause }),
  })
  return renderPart(
    "li",
    mergeProps({ ...normalizeProps(ctx.api.indicator()), ref: composeRefs(el, ref) }, rest),
    render,
    undefined,
  )
}

/** The shared panel the open content renders into, sized by the size properties. */
function Viewport({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useLevel("Viewport")
  const el = useRef<HTMLElement | null>(null)
  const open = ctx.value !== null
  const presence = usePresence(open, el, { subtree: true })
  const exiting = !open && presence.state === "exiting"
  const { setViewport, setViewportExiting } = ctx
  useIsoLayoutEffect(() => {
    setViewport(el.current)
    return () => setViewport(null)
  }, [setViewport])
  useIsoLayoutEffect(() => setViewportExiting(exiting), [exiting, setViewportExiting])
  useSizeSequence(el, ctx.value, "viewport", true)
  const props = mergeProps(
    {
      ...normalizeProps(ctx.api.viewport()),
      hidden: !open && !exiting ? true : undefined,
      ref: composeRefs(el, ref),
    },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

export type NavigationMenuPositionerProps = Own<"div"> & {
  /** What the panel is placed against: the open trigger (default) or the whole list. */
  readonly anchor?: "trigger" | "list"
  /** Side, alignment and offsets (default below, aligned to the start, 4 px away). */
  readonly positioning?: PositioningProps
}

/**
 * Places the Viewport next to the open trigger; inside an Item (no Viewport), places that
 * item's Content next to its own trigger.
 */
function Positioner({
  anchor = "trigger",
  positioning,
  render,
  ref,
  ...rest
}: NavigationMenuPositionerProps) {
  const ctx = useLevel("Positioner")
  const inItem = useContext(ItemContext)
  // An item of this level (a Sub's Positioner sits in its parent's item, not its own).
  const item = inItem?.root === ctx.root ? inItem.key : undefined
  const el = useRef<HTMLElement | null>(null)
  const open = item === undefined ? ctx.value !== null : ctx.value === item
  const presence = usePresence(open, el, { subtree: true })
  const exiting = !open && presence.state === "exiting"
  const { registerPositioner } = ctx
  const key = JSON.stringify(positioning ?? null)
  const perItem = item !== undefined
  useIsoLayoutEffect(
    () => registerPositioner(item ?? "", { anchor, positioning, perItem }),
    [anchor, key, item, perItem, registerPositioner],
  )
  const props = mergeProps(
    {
      ...normalizeProps(ctx.api.positioner(item)),
      hidden: !open && !exiting ? true : undefined,
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("div", props, render, undefined)
}

/** The parts, by name: `navigation-menu.parts.ts` re-exports them as the `NavigationMenu` namespace. */
export { Content, Indicator, Item, List, NavLink as Link, Positioner, Root, Sub, Trigger, Viewport }
