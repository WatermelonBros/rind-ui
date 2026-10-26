/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  createMenuTree,
  domHoverIntent,
  domPositioning,
  elementDir,
  getLayerStack,
  type HoverIntent,
  type LayerMeta,
  type LinkEnv,
  type LinkInput,
  layoutCapability,
  linkProps,
  type MenuActivation,
  type MenuChangeDetails,
  type MenuItemKind,
  type MenuLevelId,
  type MenuParentKind,
  type MenuProps,
  type MenuTree,
  type MenuTreeHost,
  menuConnect,
  menuIds,
  menuLayerId,
  menuLevelId,
  menuMachine,
  menuPositioning,
  menuRadioGroupMachine,
  type PositioningProps,
  type Service,
  toggleMachine,
  toKey,
  warnMenuInMenubar,
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
import { useFieldsetDisabled } from "../fieldset/context"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

/**
 * Runs `fn` and returns the last element it tried to focus while that element was inert (a
 * refused move), or null. Synchronous: the prototype is restored before returning.
 */
function focusCalls(fn: () => void): HTMLElement | null {
  if (typeof HTMLElement === "undefined") {
    fn()
    return null
  }
  const proto = HTMLElement.prototype
  const original = proto.focus
  let blocked: HTMLElement | null = null
  proto.focus = function (this: HTMLElement, options?: FocusOptions) {
    original.call(this, options)
    blocked =
      this.ownerDocument.activeElement === this ? null : this.closest("[inert]") ? this : null
  }
  try {
    fn()
  } finally {
    proto.focus = original
  }
  return blocked
}

/** Controls keep their own role inside the menu (a search field, a native button). */
const INTERACTIVE = "input, select, textarea, button, a[href], [tabindex], [contenteditable]"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** `onSelect`'s details: `cancel()` keeps the menu open. */
export interface MenuSelectDetails {
  readonly key: CollectionKey
  readonly kind: MenuItemKind
  readonly modality: MenuActivation["modality"]
  cancel(): void
}

/** What an item does on activation (its own state first, then `onSelect`). */
interface Activation {
  readonly activate?: ((a: MenuActivation) => void) | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}

/** A menubar hosting a root level (add-menubar). */
export interface MenuHost {
  readonly parentKind: MenuParentKind
  readonly host?: MenuTreeHost | undefined
  /** The bar's roving tabindex for this trigger. */
  readonly tabIndex?: Accessor<number | undefined> | undefined
  /** The bar's item key for this trigger. */
  readonly key?: CollectionKey | undefined
}

/** Provided by a menubar around its menus (add-menubar). */
export const MenuHostContext = createContext<MenuHost | null>(null)

type View = ReturnType<Service<typeof menuMachine>["view"]>

interface Level {
  readonly service: Service<typeof menuMachine>
  readonly view: Accessor<View>
  readonly levelId: MenuLevelId
  readonly level: "root" | "submenu"
  readonly props: Accessor<MenuProps>
  readonly tree: MenuTree
  readonly keepMounted: Accessor<boolean>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly activations: Map<CollectionKey, Activation>
  readonly submenus: Map<CollectionKey, () => void>
  readonly hoverIntent: HoverIntent
  readonly trigger: Accessor<HTMLElement | null>
  readonly setTrigger: (el: HTMLElement | null) => void
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
  /** A submenu's content is named by its trigger item. */
  readonly labelledBy?: string | undefined
  readonly inMenubar: boolean
  /** A context menu: the trigger is a region. */
  readonly region?: boolean | undefined
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: Accessor<LayerMeta | undefined>
}

const LevelContext = createContext<Level>()
function useLevel(part: string): Level {
  const ctx = useContext(LevelContext)
  if (!ctx) throw new Error(`Menu.${part} must be inside Menu.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(levelId: string, view: Accessor<View>) {
  const env = useEnvironment()
  const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const open = view().matches("open")
      setMeta(undefined)
      if (!open) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => setMeta(stack.get(menuLayerId(levelId))?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  return meta
}

/** The connect output of a part (read in a computation). */
function useApi(ctx: Level, extra: Accessor<{ dir?: "ltr" | "rtl" | undefined }> = () => ({})) {
  const env = useEnvironment()
  return createMemo(() => {
    const view = ctx.view()
    const props = ctx.props()
    return menuConnect(
      {
        instance: ctx.levelId,
        level: ctx.level,
        open: view.matches("open"),
        modal: props.modal !== false,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        collection: props.collection,
        highlightedKey: view.context.highlightedKey,
        highlightSource: view.context.highlightSource,
        typingAhead: () => {
          const t = ctx.service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
        },
        contentMounted: ctx.contentMounted(),
        labelledBy: ctx.labelledBy,
        meta: ctx.meta(),
        manual: menuPositioning(props).mode === "manual",
        inMenubar: ctx.inMenubar,
        region: ctx.region,
        ...extra(),
      } as Parameters<typeof menuConnect>[0],
      ctx.service.send,
      env,
    )
  })
}

type LevelOptions = {
  /** Arrow navigation wraps from the last item to the first and back. Default: true. */
  readonly loop?: boolean | undefined
  /** Disabled items stay reachable by navigation (they still cannot be activated). Default: true. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). Default: the dropdown preset (submenu or pointer preset for a submenu or context menu). */
  readonly positioning?: PositioningProps | undefined
  /** Milliseconds the pointer rests on a submenu trigger before it opens. Default: 100. */
  readonly submenuOpenDelay?: number | undefined
  /** Milliseconds the pointer may rest inside the grace area towards an open submenu before it closes. Default: 300. */
  readonly submenuGraceTimeout?: number | undefined
}

/** One level's service: its items, its tree registration and its adapter registries. */
function useLevelService(input: {
  readonly level: "root" | "submenu"
  readonly levelId: MenuLevelId
  readonly parentLevel?: MenuLevelId | undefined
  readonly tree: MenuTree
  readonly trigger: Accessor<HTMLElement | null>
  readonly options: LevelOptions
  readonly controllable?: () => Pick<MenuProps, "open" | "defaultOpen" | "onOpenChange" | "modal">
  /** One per tree: a parent level sees its submenu's transit (the grace area). */
  readonly hoverIntent?: HoverIntent | undefined
  /** A context menu's root level. */
  readonly region?: Pick<MenuProps, "onAnchorChange"> | undefined
}) {
  const env = useEnvironment(announcerCapability, layoutCapability)
  const parent = useParentLayer()
  const { collection: registered, registry } = useCollectionItems()
  const hoverIntent = input.hoverIntent ?? domHoverIntent(env)
  const menuEnv = {
    ...env,
    position: domPositioning(env),
    hoverIntent,
    menuTree: input.tree,
  }
  const activations = new Map<CollectionKey, Activation>()
  const submenus = new Map<CollectionKey, () => void>()
  const ids = (() => {
    const m = menuIds(input.levelId)
    return { list: m.content, item: m.item }
  })()
  const o = input.options
  const props = (): MenuProps =>
    ({
      ...(input.region ? { region: true, onAnchorChange: input.region.onAnchorChange } : {}),
      ...input.controllable?.(),
      collection: registered() ?? EMPTY,
      strategy: "roving",
      ids,
      loop: o.loop ?? true,
      focusableWhenDisabled: o.focusableWhenDisabled ?? true,
      typeaheadTimeout: o.typeaheadTimeout,
      positioning: o.positioning,
      submenuOpenDelay: o.submenuOpenDelay,
      submenuGraceTimeout: o.submenuGraceTimeout,
      level: input.level,
      levelId: input.levelId,
      parentLevel: input.parentLevel,
      parent: parent(),
      getTrigger: () => untrack(input.trigger),
      onActivate: (a: MenuActivation) => {
        const entry = activations.get(a.key)
        if (!entry) return true
        entry.activate?.(a)
        let cancelled = false
        const blocked = focusCalls(() =>
          entry.onSelect?.({
            key: a.key,
            kind: a.kind,
            modality: a.modality,
            cancel: () => {
              cancelled = true
            },
          }),
        )
        // A modal menu keeps the page inert until it closes: a focus move `onSelect` made
        // outside (an editor) was refused, so it is made again once the menu is gone.
        if (blocked && !cancelled) {
          env.scheduler.requestAnimationFrame(() => {
            if (blocked.isConnected && !blocked.closest("[inert]")) blocked.focus()
          })
        }
        return !cancelled
      },
      openSubmenu: (key: CollectionKey) => {
        const open = submenus.get(key)
        open?.()
        return open !== undefined
      },
    }) as MenuProps
  const { view, service, send } = useMachine(menuMachine, props, menuEnv)
  const meta = useMeta(input.levelId, view)
  return { service, view, send, props, registry, activations, submenus, hoverIntent, meta }
}

/** What `actionsRef` exposes. */
export interface MenuActions {
  open(): void
  close(): void
}

export type MenuRootProps = LevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: MenuChangeDetails) => void) | undefined
  /** Default true: everything outside is inert and an outside press only closes the menu. */
  readonly modal?: boolean | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Programmatic open and close: receives `open()` and `close()` once. */
  readonly actionsRef?: ((actions: MenuActions) => void) | undefined
  /** The menu's parts: its trigger, portal, positioner and content. */
  readonly children?: JSX.Element
}

function Root(props: MenuRootProps) {
  const [own, options] = splitProps(props, [
    "id",
    "open",
    "defaultOpen",
    "onOpenChange",
    "modal",
    "keepMounted",
    "actionsRef",
    "children",
  ])
  const levelId = menuLevelId(useRootId(() => own.id)())
  const host = useContext(MenuHostContext)
  const tree = createMenuTree({
    ...(host ? { parentKind: host.parentKind } : {}),
    ...(host?.host ? { host: host.host } : {}),
  })
  const [trigger, setTrigger] = createSignal<HTMLElement | null>(null)
  const s = useLevelService({
    level: "root",
    levelId,
    tree,
    trigger,
    options,
    controllable: () => ({
      open: own.open,
      defaultOpen: own.defaultOpen,
      onOpenChange: own.onOpenChange,
      modal: own.modal ?? true,
    }),
  })
  own.actionsRef?.({ open: () => s.send({ type: "OPEN" }), close: () => s.send({ type: "CLOSE" }) })
  const [contentMounted, setContentMounted] = createSignal(false)
  const ctx: Level = {
    service: s.service,
    view: s.view,
    levelId,
    level: "root",
    props: s.props,
    tree,
    keepMounted: () => own.keepMounted === true,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    trigger,
    setTrigger,
    contentMounted,
    setContentMounted,
    inMenubar: host?.parentKind === "menubar",
    meta: s.meta,
  }
  return <LevelContext.Provider value={ctx}>{own.children}</LevelContext.Provider>
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

export interface MenuTriggerState {
  readonly open: boolean
}

export type MenuTriggerProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>, MenuTriggerState>

const isOpen = (ctx: Level) => ctx.view().matches("open")

function Trigger(props: MenuTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "disabled", "children"])
  const ctx = useLevel("Trigger")
  const host = useContext(MenuHostContext)
  const api = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  // rind's Fieldset and a native <fieldset disabled> disable it too (button-like-element).
  const fieldsetDisabled = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const disabled = () => local.disabled === true || fieldsetDisabled() || fieldsetDom()
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      // A menubar opens its menus itself (one open menu per bar).
      if (ctx.inMenubar && host?.key !== undefined) ctx.tree.parentPress(host.key, e.modality)
      else untrack(api).pressTrigger(e.modality)
    },
    disabled,
    // A label's forwarded click focuses the trigger and never opens the menu.
    labelActivation: "focus",
  })
  const [el, setEl] = createSignal<Element | null>(null)
  createEffect(() => {
    const node = el()
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    onCleanup(watch.stop)
  })
  const tag = useRenderedTag(
    () => (ctx.inMenubar ? "div" : "button"),
    () => local.render,
    el,
  )
  const state = reactive<MenuTriggerState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().trigger({
              focused: focused(),
              modality: modality(),
              pressed: press.pressed(),
              tag: tag(),
              disabled: disabled(),
              tabIndex: host?.tabIndex?.(),
            }),
          ),
          press.props,
          { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
        ),
        ref: (node: Element) => {
          setEl(node)
          ctx.setTrigger(node as HTMLElement)
        },
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <Show when={ctx.inMenubar} fallback={<button {...p}>{children()}</button>}>
      <div {...p}>{children()}</div>
    </Show>
  ))
}

function usePartPresence(ctx: Level, subtree = false) {
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, {
    keepMounted: ctx.keepMounted,
    subtree: () => subtree,
  })
  return { setNode, ...presence }
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Level) {
  const env = useEnvironment()
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      if (!isOpen(ctx)) return
      setDir(elementDir(ctx.trigger(), env.locale.dir()))
    })
  })
  return dir
}

export type MenuDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Positioner(props: MenuDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Positioner")
  const dir = useTriggerDir(ctx)
  const api = useApi(ctx, () => (dir() ? { dir: dir() } : {}))
  // It holds the content: it stays while the content's exit animations run.
  const part = usePartPresence(ctx, true)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().positioner()),
        hidden: !isOpen(ctx) && ctx.keepMounted(),
        ref: part.setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  return (
    <Show when={part.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

export interface MenuContentState {
  readonly open: boolean
}

export type MenuContentProps = Own<JSX.HTMLAttributes<HTMLDivElement>, MenuContentState>

function Content(props: MenuContentProps) {
  const [local, rest] = splitProps(props, ["render", "children", "aria-label", "aria-labelledby"])
  const ctx = useLevel("Content")
  const api = useApi(ctx)
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, { keepMounted: ctx.keepMounted })
  afterMount(() => {
    createEffect(() => {
      const el = presence.mounted() ? node() : null
      ctx.setContentMounted(el !== null)
      if (!el) return
      onCleanup(() => ctx.setContentMounted(false))
      // Any other element directly inside the menu is presentational for the menu role.
      const mark = () => {
        warnMenuInMenubar(el)
        for (const child of el.children) {
          if (
            !child.hasAttribute("data-scope") &&
            !child.hasAttribute("role") &&
            !child.matches(INTERACTIVE)
          ) {
            child.setAttribute("role", "none")
          }
        }
      }
      mark()
      const observer = new MutationObserver(mark)
      observer.observe(el, { childList: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const exiting = () => !isOpen(ctx) && presence.state() === "exiting"
  const state = reactive<MenuContentState>(() => ({ open: isOpen(ctx) }))
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
  // Layers opened from here (submenus, dialogs from items) are this level's children.
  const children = () => (
    <LayerProvider layer={menuLayerId(ctx.levelId)} kind="menu">
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

function Arrow(props: MenuDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Arrow")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().arrow()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The item's checked state, for its indicator. */
const ItemContext = createContext<{ readonly checked: Accessor<boolean> }>()

export interface MenuItemRenderState {
  readonly highlighted: boolean
  readonly disabled: boolean
}

type ItemBase = {
  /** The item's key (default: generated). */
  readonly value?: string | undefined
  /** Typeahead text (default: the text content). */
  readonly textValue?: string | undefined
  readonly disabled?: boolean | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}

/** Registers an item and its activation with the level; the item's key. */
function useItem(
  ctx: Level,
  item: () => { value?: string | undefined; textValue?: string | undefined; disabled: boolean },
  activation: () => Activation,
  el: Accessor<Element | null>,
): Accessor<CollectionKey> {
  const generated = createUniqueId()
  const key = createMemo(() => toKey(item().value ?? generated))
  useRegisterItem(
    ctx.registry,
    () => ({ key: key(), textValue: item().textValue, disabled: item().disabled }),
    el,
  )
  createEffect(() => {
    const k = key()
    ctx.activations.set(k, {
      activate: (a) => untrack(activation).activate?.(a),
      onSelect: (d) => untrack(activation).onSelect?.(d),
    })
    onCleanup(() => {
      ctx.activations.delete(k)
    })
  })
  return key
}

export type MenuItemProps = Omit<
  Own<JSX.HTMLAttributes<HTMLDivElement>, MenuItemRenderState>,
  "onSelect"
> &
  ItemBase & {
    /** Default true: activating the item closes the menu tree. */
    readonly closeOnSelect?: boolean | undefined
    /** A link item (rendered as `<a>`). */
    readonly href?: LinkInput["href"] | undefined
    /** The link's `target`; a target other than `_self` leaves navigation to the browser. */
    readonly target?: string | undefined
    /** The link's `rel`. */
    readonly rel?: string | undefined
    /** The link's `download`: `true` or a file name; the browser downloads instead of navigating. */
    readonly download?: boolean | string | undefined
    /** Passed unchanged to the router's `navigate`. */
    readonly routerOptions?: LinkInput["routerOptions"] | undefined
  }

function Item(props: MenuItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "textValue",
    "disabled",
    "closeOnSelect",
    "onSelect",
    "href",
    "target",
    "rel",
    "download",
    "routerOptions",
    "render",
    "children",
  ])
  const ctx = useLevel("Item")
  const env = useEnvironment()
  const api = useApi(ctx)
  const [el, setEl] = createSignal<Element | null>(null)
  const disabled = () => local.disabled === true
  const key = useItem(
    ctx,
    () => ({ value: local.value, textValue: local.textValue, disabled: disabled() }),
    () => ({ onSelect: local.onSelect }),
    el,
  )
  const link = () => local.href !== undefined
  const tag = useRenderedTag(
    () => (link() ? "a" : "div"),
    () => local.render,
    el,
  )
  // Client only, after mount: the server and the first client render know no origin.
  const [origin, setOrigin] = createSignal<string | undefined>(undefined)
  afterMount(() => setOrigin(globalThis.location?.origin))
  const closeOnSelect = () => local.closeOnSelect ?? true
  const state = reactive<MenuItemRenderState>(() => ({
    highlighted: ctx.view().context.highlightedKey === key(),
    disabled: disabled(),
  }))
  const merged = createMemo(() => {
    const linkPart = link()
      ? linkProps(
          {
            href: local.href as LinkInput["href"],
            target: local.target,
            rel: local.rel,
            download: local.download,
            routerOptions: local.routerOptions,
            disabled: disabled(),
            focusableWhenDisabled: true,
            origin: origin(),
            tag: tag(),
            onActivate: (a) => {
              if (a.disposition === "same-tab")
                untrack(api).activateLink(key(), a.modality, closeOnSelect())
            },
          },
          env as LinkEnv,
        )
      : {}
    // The menu owns the role, focus and highlight; the link part only its navigation.
    const { role: _role, tabindex: _tabindex, ...navigation } = linkPart as Record<string, unknown>
    const own = api().item(key(), {
      kind: link() ? "link-item" : "item",
      disabled: disabled(),
      closeOnSelect: closeOnSelect(),
    })
    return mergeProps(
      {
        ...joinHandlers(
          normalizeProps(own),
          normalizeProps(navigation as Parameters<typeof normalizeProps>[0]),
        ),
        ref: setEl,
      },
      rest,
    )
  })
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <Show when={link()} fallback={<div {...p}>{children()}</div>}>
      <a {...p}>{children()}</a>
    </Show>
  ))
}

export type MenuCheckboxItemProps = Omit<
  Own<JSX.HTMLAttributes<HTMLDivElement>, MenuItemRenderState>,
  "onSelect"
> &
  ItemBase & {
    readonly checked?: boolean | undefined
    /** Initial checked state while uncontrolled. Default: false. */
    readonly defaultChecked?: boolean | undefined
    /** Called with the new checked state each time the item is toggled. */
    readonly onCheckedChange?: ((checked: boolean) => void) | undefined
    /** Default false: the menu stays open while options are toggled. */
    readonly closeOnSelect?: boolean | undefined
  }

function CheckboxItem(props: MenuCheckboxItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "textValue",
    "disabled",
    "closeOnSelect",
    "checked",
    "defaultChecked",
    "onCheckedChange",
    "onSelect",
    "render",
    "children",
  ])
  const ctx = useLevel("CheckboxItem")
  const api = useApi(ctx)
  const toggle = useMachine(toggleMachine, () => ({
    pressed: local.checked,
    defaultPressed: local.defaultChecked,
    onPressedChange: local.onCheckedChange ? (p: boolean) => local.onCheckedChange?.(p) : undefined,
  }))
  const on = () => toggle.view().values.pressed === true
  const [el, setEl] = createSignal<Element | null>(null)
  const disabled = () => local.disabled === true
  const key = useItem(
    ctx,
    () => ({ value: local.value, textValue: local.textValue, disabled: disabled() }),
    () => ({
      onSelect: local.onSelect,
      activate: (a: MenuActivation) =>
        toggle.send({
          type: "PRESS",
          modality: a.modality,
          pointerType: a.modality === "pointer" ? "mouse" : a.modality,
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        } as never),
    }),
    el,
  )
  const state = reactive<MenuItemRenderState>(() => ({
    highlighted: ctx.view().context.highlightedKey === key(),
    disabled: disabled(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().item(key(), {
            kind: "checkbox-item",
            disabled: disabled(),
            closeOnSelect: local.closeOnSelect ?? false,
            checked: on(),
          }),
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => (
    <ItemContext.Provider value={{ checked: on }}>{local.children}</ItemContext.Provider>
  )
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

const RadioGroupContext = createContext<{
  readonly value: Accessor<string | null>
  readonly select: (value: string) => void
  readonly disabled: Accessor<boolean>
}>()

export type MenuRadioGroupProps = Omit<Own<JSX.HTMLAttributes<HTMLDivElement>>, "defaultValue"> & {
  readonly value?: string | null | undefined
  /** Initial selected value while uncontrolled. Default: null. */
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?: ((value: string | null) => void) | undefined
  readonly disabled?: boolean | undefined
}

function RadioGroup(props: MenuRadioGroupProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "disabled",
    "render",
    "children",
  ])
  const ctx = useLevel("RadioGroup")
  const api = useApi(ctx)
  const disabled = () => local.disabled === true
  const group = useMachine(menuRadioGroupMachine, () => ({
    value: local.value,
    defaultValue: local.defaultValue,
    onValueChange: local.onValueChange ? (v: string | null) => local.onValueChange?.(v) : undefined,
    disabled: disabled(),
  }))
  const current = () => group.view().values.value ?? null
  const merged = createMemo(() =>
    mergeProps(normalizeProps(api().radioGroup({ disabled: disabled() })), rest),
  )
  const children = () => (
    <RadioGroupContext.Provider
      value={{
        value: current,
        select: (v) => group.send({ type: "SELECT", value: v }),
        disabled,
      }}
    >
      {local.children}
    </RadioGroupContext.Provider>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type MenuRadioItemProps = Omit<
  Own<JSX.HTMLAttributes<HTMLDivElement>, MenuItemRenderState>,
  "onSelect"
> &
  Omit<ItemBase, "value"> & {
    readonly value: string
    /** Default false. */
    readonly closeOnSelect?: boolean | undefined
  }

function RadioItem(props: MenuRadioItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "textValue",
    "disabled",
    "closeOnSelect",
    "onSelect",
    "render",
    "children",
  ])
  const ctx = useLevel("RadioItem")
  const group = useContext(RadioGroupContext)
  if (!group) throw new Error("Menu.RadioItem must be inside Menu.RadioGroup")
  const disabled = () => local.disabled === true || group.disabled()
  const api = useApi(ctx)
  const [el, setEl] = createSignal<Element | null>(null)
  const key = useItem(
    ctx,
    () => ({ value: local.value, textValue: local.textValue, disabled: disabled() }),
    () => ({ onSelect: local.onSelect, activate: () => group.select(local.value) }),
    el,
  )
  const checked = () => group.value() === local.value
  const state = reactive<MenuItemRenderState>(() => ({
    highlighted: ctx.view().context.highlightedKey === key(),
    disabled: disabled(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().item(key(), {
            kind: "radio-item",
            disabled: disabled(),
            closeOnSelect: local.closeOnSelect ?? false,
            checked: checked(),
          }),
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => (
    <ItemContext.Provider value={{ checked }}>{local.children}</ItemContext.Provider>
  )
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

export type MenuItemIndicatorProps = Own<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while unchecked too (hidden by CSS on `data-state`). */
  readonly keepMounted?: boolean | undefined
}

function ItemIndicator(props: MenuItemIndicatorProps) {
  const [local, rest] = splitProps(props, ["keepMounted", "render", "children"])
  const ctx = useLevel("ItemIndicator")
  const item = useContext(ItemContext)
  if (!item) throw new Error("Menu.ItemIndicator must be inside a checkbox or radio item")
  const api = useApi(ctx)
  const merged = createMemo(() =>
    mergeProps(normalizeProps(api().itemIndicator(item.checked())), rest),
  )
  const children = () => local.children
  return (
    <Show when={item.checked() || local.keepMounted === true}>
      {untrack(() =>
        renderPart(local.render, merged, undefined, children, (p) => (
          <span {...p}>{children()}</span>
        )),
      )}
    </Show>
  )
}

function ItemText(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("ItemText")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().itemText()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

const GroupContext = createContext<{
  readonly labelId: string
  readonly setLabelled: (on: boolean) => void
}>()

function Group(props: MenuDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("Group")
  const api = useApi(ctx)
  const labelId = `${createUniqueId()}-label`
  const [labelled, setLabelled] = createSignal(false)
  const merged = createMemo(() =>
    mergeProps(normalizeProps(api().group(labelled() ? labelId : undefined)), rest),
  )
  const children = () => (
    <GroupContext.Provider value={{ labelId, setLabelled }}>{local.children}</GroupContext.Provider>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function GroupLabel(props: MenuDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useLevel("GroupLabel")
  const group = useContext(GroupContext)
  if (!group) throw new Error("Menu.GroupLabel must be inside Menu.Group")
  const api = useApi(ctx)
  createEffect(() => {
    group.setLabelled(true)
    onCleanup(() => group.setLabelled(false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(api().groupLabel(group.labelId)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type MenuSeparatorProps = MenuDivProps & {
  /** Default: perpendicular to the menu (horizontal in a vertical menu). */
  readonly orientation?: "horizontal" | "vertical" | undefined
}

function Separator(props: MenuSeparatorProps) {
  const [local, rest] = splitProps(props, ["orientation", "render", "children"])
  const ctx = useLevel("Separator")
  const api = useApi(ctx)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => "div",
    () => local.render,
    el,
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().separator({ orientation: local.orientation, tag: tag() })),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const SubmenuContext = createContext<{
  readonly parent: Level
  readonly key: CollectionKey
  readonly setTrigger: (el: HTMLElement | null) => void
  /** The SubmenuTrigger's `disabled`: the expand key never opens a disabled submenu. */
  readonly disabled: { current: boolean }
}>()

export type MenuSubmenuProps = Omit<LevelOptions, "loop"> & {
  /** Arrow navigation in this submenu wraps from the last item to the first and back. Default: true. */
  readonly loop?: boolean | undefined
  /** The submenu's parts: its `Menu.SubmenuTrigger` and its portal, positioner and content. */
  readonly children?: JSX.Element
}

function Submenu(props: MenuSubmenuProps) {
  const [own, options] = splitProps(props, ["children"])
  const parent = useLevel("Submenu")
  const levelId = menuLevelId(useRootId(() => undefined)())
  const key = toKey(`${levelId}-trigger`)
  const [trigger, setTrigger] = createSignal<HTMLElement | null>(null)
  const s = useLevelService({
    level: "submenu",
    levelId,
    parentLevel: parent.levelId,
    tree: parent.tree,
    trigger,
    options,
    hoverIntent: parent.hoverIntent,
  })
  const disabled = { current: false }
  createEffect(() => {
    parent.submenus.set(key, () => {
      if (!disabled.current) s.send({ type: "SUB_OPEN" })
    })
    onCleanup(() => {
      parent.submenus.delete(key)
    })
  })
  const [contentMounted, setContentMounted] = createSignal(false)
  const ctx: Level = {
    service: s.service,
    view: s.view,
    levelId,
    level: "submenu",
    props: s.props,
    tree: parent.tree,
    keepMounted: parent.keepMounted,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    trigger,
    setTrigger,
    contentMounted,
    setContentMounted,
    labelledBy: menuIds(parent.levelId).item(key),
    inMenubar: false,
    meta: s.meta,
  }
  return (
    <SubmenuContext.Provider value={{ parent, key, setTrigger, disabled }}>
      <LevelContext.Provider value={ctx}>{own.children}</LevelContext.Provider>
    </SubmenuContext.Provider>
  )
}

export type MenuSubmenuTriggerProps = Own<
  JSX.HTMLAttributes<HTMLDivElement>,
  MenuItemRenderState
> & {
  readonly textValue?: string | undefined
  readonly disabled?: boolean | undefined
}

function SubmenuTrigger(props: MenuSubmenuTriggerProps) {
  const [local, rest] = splitProps(props, ["textValue", "disabled", "render", "children"])
  const sub = useContext(SubmenuContext)
  const child = useLevel("SubmenuTrigger")
  if (!sub) throw new Error("Menu.SubmenuTrigger must be inside Menu.Submenu")
  const env = useEnvironment()
  const api = useApi(sub.parent)
  const [el, setEl] = createSignal<Element | null>(null)
  const disabled = () => local.disabled === true
  useRegisterItem(
    sub.parent.registry,
    () => ({ key: sub.key, textValue: local.textValue, disabled: disabled() }),
    el,
  )
  createEffect(() => {
    sub.disabled.current = disabled()
  })
  const [focused, setFocused] = createSignal(false)
  const hover = child.hoverIntent.triggerProps((e) => child.service.send(e))
  const state = reactive<MenuItemRenderState>(() => ({
    highlighted: sub.parent.view().context.highlightedKey === sub.key,
    disabled: disabled(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().submenuTrigger(sub.key, {
              disabled: disabled(),
              focused: focused(),
              open: child.view().matches("open"),
              contentId: menuIds(child.levelId).content,
              contentMounted: child.contentMounted(),
            }),
          ),
          disabled()
            ? {}
            : { onPointerMove: hover.onPointerMove, onPointerLeave: hover.onPointerLeave },
          {
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
            onClick: (e: { preventDefault(): void }) => {
              if (disabled()) {
                e.preventDefault()
                return
              }
              // Pointer, assistive technology, and Enter / Space (the level clicks the item).
              child.service.send({ type: "TRIGGER_PRESS", modality: env.modality.modality() })
            },
          },
        ),
        ref: (node: Element) => {
          setEl(node)
          sub.setTrigger(node as HTMLElement)
        },
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

function Portal(props: PortalProps) {
  const ctx = useLevel("Portal")
  // The host carries the trigger's theme, dir and lang.
  return <PortalPart logicalParent={ctx.trigger} {...props} />
}

/** The parts, by name: `menu.parts.ts` re-exports them as the `Menu` namespace. */
// Internal: a context menu builds its root level from these (not public API).
export {
  Arrow,
  CheckboxItem,
  Content,
  Group,
  GroupLabel,
  Item,
  ItemIndicator,
  ItemText,
  type Level as MenuLevel,
  LevelContext as MenuLevelContext,
  type LevelOptions as MenuLevelOptions,
  Portal,
  Positioner,
  RadioGroup,
  RadioItem,
  Root,
  Separator,
  Submenu,
  SubmenuTrigger,
  Trigger,
  useApi as useMenuApi,
  useLevelService as useMenuLevelService,
}
