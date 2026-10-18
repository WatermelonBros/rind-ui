import {
  type CollectionKey,
  createListCollection,
  createMenuTree,
  domHoverIntent,
  domPositioning,
  getLayerStack,
  type HoverIntent,
  type LayerMeta,
  type LinkEnv,
  type LinkInput,
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
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  isValidElement,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly tabIndex?: number | undefined
  /** The bar's item key for this trigger. */
  readonly key?: CollectionKey | undefined
}

/** Provided by a menubar around its menus (add-menubar). */
export const MenuHostContext = createContext<MenuHost | null>(null)

interface Level {
  readonly service: Service<typeof menuMachine>
  readonly levelId: MenuLevelId
  readonly level: "root" | "submenu"
  readonly props: MenuProps
  readonly tree: MenuTree
  readonly keepMounted: boolean
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly activations: Map<CollectionKey, Activation>
  readonly submenus: Map<CollectionKey, () => void>
  readonly hoverIntent: HoverIntent
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
  /** A submenu's content is named by its trigger item. */
  readonly labelledBy?: string | undefined
  readonly inMenubar: boolean
  /** A context menu: the trigger is a region. */
  readonly region?: boolean | undefined
}

const LevelContext = createContext<Level | null>(null)
function useLevel(part: string): Level {
  const ctx = useContext(LevelContext)
  if (!ctx) throw new Error(`Menu.${part} must be inside Menu.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(levelId: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(menuLayerId(levelId))?.meta())
    read()
    return stack.subscribe(read)
  }, [levelId, env, open])
  return meta
}

function useApi(ctx: Level, extra: { dir?: "ltr" | "rtl" } = {}) {
  const env = useEnvironment()
  const view = useSelector(ctx.service, (v) => v)
  const open = view.matches("open")
  const meta = useMeta(ctx.levelId, open)
  const api = menuConnect(
    {
      instance: ctx.levelId,
      level: ctx.level,
      open,
      modal: ctx.props.modal !== false,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      collection: ctx.props.collection,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (ctx.props.typeaheadTimeout ?? 1000)
      },
      contentMounted: ctx.contentMounted,
      labelledBy: ctx.labelledBy,
      meta,
      manual: menuPositioning(ctx.props).mode === "manual",
      inMenubar: ctx.inMenubar,
      region: ctx.region,
      ...extra,
    },
    ctx.service.send,
    env,
  )
  return { open, api, view }
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
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly options: LevelOptions
  readonly controllable?: Pick<MenuProps, "open" | "defaultOpen" | "onOpenChange" | "modal">
  /** One per tree: a parent level sees its submenu's transit (the grace area). */
  readonly hoverIntent?: HoverIntent | undefined
  /** A context menu's root level. */
  readonly region?: Pick<MenuProps, "onAnchorChange"> | undefined
}) {
  const env = useEnvironment()
  const parent = useParentLayer()
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const [own] = useState(() => (input.hoverIntent ? null : domHoverIntent(env)))
  const hoverIntent = input.hoverIntent ?? (own as HoverIntent) // one of the two is set
  const menuEnv = useMemo(
    () => ({ ...env, position: domPositioning(env), hoverIntent, menuTree: input.tree }),
    [env, hoverIntent, input.tree],
  )
  const activations = useRef(new Map<CollectionKey, Activation>()).current
  const submenus = useRef(new Map<CollectionKey, () => void>()).current
  const ids = useMemo(() => {
    const m = menuIds(input.levelId)
    return { list: m.content, item: m.item }
  }, [input.levelId])
  const o = input.options
  const props: MenuProps = {
    ...(input.region ? { region: true, onAnchorChange: input.region.onAnchorChange } : {}),
    ...input.controllable,
    collection,
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
    parent,
    getTrigger: () => input.triggerRef.current,
    onActivate: (a) => {
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
    openSubmenu: (key) => {
      const open = submenus.get(key)
      open?.()
      return open !== undefined
    },
  }
  const { service, send } = useMachine(menuMachine, props, menuEnv)
  return { service, send, props, registry, activations, submenus, hoverIntent }
}

/** What `actionsRef` exposes. */
export interface MenuActions {
  open(): void
  close(): void
}

export type MenuRootProps = LevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: MenuChangeDetails) => void
  /** Default true: everything outside is inert and an outside press only closes the menu. */
  readonly modal?: boolean
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly actionsRef?: Ref<MenuActions>
  /** The menu's parts: its trigger, portal, positioner and content. */
  readonly children?: ReactNode
}

function Root({
  id,
  open,
  defaultOpen,
  onOpenChange,
  modal = true,
  keepMounted = false,
  actionsRef,
  children,
  ...options
}: MenuRootProps) {
  const levelId = menuLevelId(useRootId(id))
  const host = useContext(MenuHostContext)
  const [tree] = useState(() =>
    createMenuTree({
      ...(host ? { parentKind: host.parentKind } : {}),
      ...(host?.host ? { host: host.host } : {}),
    }),
  )
  const triggerRef = useRef<HTMLElement | null>(null)
  const s = useLevelService({
    level: "root",
    levelId,
    tree,
    triggerRef,
    options,
    controllable: { open, defaultOpen, onOpenChange, modal },
  })
  useImperativeHandle(
    actionsRef,
    () => ({ open: () => s.send({ type: "OPEN" }), close: () => s.send({ type: "CLOSE" }) }),
    [s.send],
  )
  const [contentMounted, setContentMounted] = useState(false)
  const ctx: Level = {
    service: s.service,
    levelId,
    level: "root",
    props: s.props,
    tree,
    keepMounted,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    triggerRef,
    contentMounted,
    setContentMounted,
    inMenubar: host?.parentKind === "menubar",
  }
  return <LevelContext value={ctx}>{children}</LevelContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

export interface MenuTriggerState {
  readonly open: boolean
}

function Trigger({ render, ref, disabled = false, ...rest }: Own<"button", MenuTriggerState>) {
  const ctx = useLevel("Trigger")
  const host = useContext(MenuHostContext)
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      // A menubar opens its menus itself (one open menu per bar).
      if (ctx.inMenubar && host?.key !== undefined) ctx.tree.parentPress(host.key, e.modality)
      else api.pressTrigger(e.modality)
    },
    disabled: () => disabled,
    // A label's forwarded click focuses the trigger and never opens the menu.
    labelActivation: "focus",
  })
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(ctx.inMenubar ? "div" : "button", render, el)
  const own = normalizeProps(
    api.trigger({
      focused,
      modality,
      pressed: press.pressed,
      tag,
      disabled,
      tabIndex: host?.tabIndex,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, composeRefs(ctx.triggerRef, ref)),
    },
    rest,
  )
  return renderPart(ctx.inMenubar ? "div" : "button", props, render, { open })
}

function usePartPresence(ctx: Level, open: boolean, subtree = false) {
  const node = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree })
  return { node, ...presence }
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Level, open: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (!open) return
    const found = ctx.triggerRef.current?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.triggerRef])
  return dir
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useLevel("Positioner")
  const open = useSelector(ctx.service, (v) => v.matches("open"))
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

export interface MenuContentState {
  readonly open: boolean
}

function Content({
  render,
  ref,
  children,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...rest
}: Own<"div", MenuContentState>) {
  const ctx = useLevel("Content")
  const { api, open } = useApi(ctx)
  const { node, mounted, state } = usePartPresence(ctx, open)
  const { setContentMounted } = ctx
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  // Any other element directly inside the menu is presentational for the menu role.
  useIsoLayoutEffect(() => {
    for (const child of node.current?.children ?? []) {
      if (
        !child.hasAttribute("data-scope") &&
        !child.hasAttribute("role") &&
        !child.matches(INTERACTIVE)
      ) {
        child.setAttribute("role", "none")
      }
    }
  })
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
      // Layers opened from here (submenus, dialogs from items) are this level's children.
      children: (
        <LayerProvider layer={menuLayerId(ctx.levelId)} kind="menu">
          {children}
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, { open })
}

function Arrow({ render, ...rest }: Own<"div">) {
  const ctx = useLevel("Arrow")
  const { api } = useApi(ctx)
  return renderPart("div", mergeProps(normalizeProps(api.arrow()), rest), render, undefined)
}

/** The item's checked state, for its indicator. */
const ItemContext = createContext<{ readonly checked: boolean } | null>(null)

export interface MenuItemRenderState {
  readonly highlighted: boolean
  readonly disabled: boolean
}

type ItemBase = {
  /** The item's key (default: generated). */
  readonly value?: string
  /** Typeahead text (default: the text content). */
  readonly textValue?: string
  readonly disabled?: boolean
  readonly onSelect?: (details: MenuSelectDetails) => void
}

/** Registers an item and its activation with the level; the item's key. */
function useItem(
  ctx: Level,
  item: { value?: string | undefined; textValue?: string | undefined; disabled: boolean },
  activation: Activation,
  el: RefObject<HTMLElement | null>,
): CollectionKey {
  const generated = useId()
  const key = toKey(item.value ?? generated)
  useRegisterItem(ctx.registry, { key, textValue: item.textValue, disabled: item.disabled }, el)
  const latest = useRef(activation)
  latest.current = activation
  const { activations } = ctx
  useIsoLayoutEffect(() => {
    activations.set(key, {
      activate: (a) => latest.current.activate?.(a),
      onSelect: (d) => latest.current.onSelect?.(d),
    })
    return () => {
      activations.delete(key)
    }
  }, [activations, key])
  return key
}

const noSubscription = () => () => {}
const clientOrigin = () => globalThis.location?.origin
const serverOrigin = () => undefined

export type MenuItemProps = Omit<Own<"div", MenuItemRenderState>, "onSelect"> &
  ItemBase & {
    /** Default true: activating the item closes the menu tree. */
    readonly closeOnSelect?: boolean
    /** A link item (rendered as `<a>`). */
    readonly href?: LinkInput["href"]
    /** The link's `target`; a target other than `_self` leaves navigation to the browser. */
    readonly target?: string
    /** The link's `rel`. */
    readonly rel?: string
    /** The link's `download`: `true` or a file name; the browser downloads instead of navigating. */
    readonly download?: boolean | string
    /** Passed unchanged to the router's `navigate`. */
    readonly routerOptions?: LinkInput["routerOptions"]
  }

function Item({
  value,
  textValue,
  disabled = false,
  closeOnSelect = true,
  onSelect,
  href,
  target,
  rel,
  download,
  routerOptions,
  render,
  ref,
  ...rest
}: MenuItemProps) {
  const ctx = useLevel("Item")
  const env = useEnvironment()
  const { api, view } = useApi(ctx)
  const el = useRef<HTMLElement | null>(null)
  const key = useItem(ctx, { value, textValue, disabled }, { onSelect }, el)
  const link = href !== undefined
  const tag = useRenderedTag(link ? "a" : "div", render, el)
  const origin = useSyncExternalStore(noSubscription, clientOrigin, serverOrigin)
  // A rendered component (a router's Link) navigates itself.
  const linkEnv: LinkEnv =
    isValidElement(render) && typeof render.type !== "string" ? { ...env, router: undefined } : env
  const linkPart = link
    ? linkProps(
        {
          href,
          target,
          rel,
          download,
          routerOptions,
          disabled,
          focusableWhenDisabled: true,
          origin,
          tag,
          onActivate: (a) => {
            if (a.disposition === "same-tab") api.activateLink(key, a.modality, closeOnSelect)
          },
        },
        linkEnv,
      )
    : {}
  // The menu owns the role, focus and highlight; the link part only its navigation.
  const { role: _role, tabindex: _tabindex, ...navigation } = linkPart
  const own = api.item(key, {
    kind: link ? "link-item" : "item",
    disabled,
    closeOnSelect,
  })
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(own), normalizeProps(navigation)),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart(link ? "a" : "div", props, render, {
    highlighted: view.context.highlightedKey === key,
    disabled,
  })
}

export type MenuCheckboxItemProps = Omit<Own<"div", MenuItemRenderState>, "onSelect"> &
  ItemBase & {
    readonly checked?: boolean
    /** Initial checked state while uncontrolled. Default: false. */
    readonly defaultChecked?: boolean
    /** Called with the new checked state each time the item is toggled. */
    readonly onCheckedChange?: (checked: boolean) => void
    /** Default false: the menu stays open while options are toggled. */
    readonly closeOnSelect?: boolean
  }

function CheckboxItem({
  value,
  textValue,
  disabled = false,
  closeOnSelect = false,
  checked,
  defaultChecked,
  onCheckedChange,
  onSelect,
  render,
  ref,
  children,
  ...rest
}: MenuCheckboxItemProps) {
  const ctx = useLevel("CheckboxItem")
  const { api, view } = useApi(ctx)
  const toggle = useMachine(toggleMachine, {
    pressed: checked,
    defaultPressed: defaultChecked,
    onPressedChange: onCheckedChange ? (p) => onCheckedChange(p) : undefined,
  })
  const on = toggle.view.values.pressed === true
  const el = useRef<HTMLElement | null>(null)
  const key = useItem(
    ctx,
    { value, textValue, disabled },
    {
      onSelect,
      activate: (a) =>
        toggle.send({
          type: "PRESS",
          modality: a.modality,
          pointerType: a.modality === "pointer" ? "mouse" : a.modality,
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        }),
    },
    el,
  )
  const own = api.item(key, { kind: "checkbox-item", disabled, closeOnSelect, checked: on })
  const props = mergeProps(
    { ...normalizeProps(own), ref: composeRefs(el, ref) },
    {
      ...rest,
      children: <ItemContext value={{ checked: on }}>{children}</ItemContext>,
    },
  )
  return renderPart("div", props, render, {
    highlighted: view.context.highlightedKey === key,
    disabled,
  })
}

const RadioGroupContext = createContext<{
  readonly value: string | null
  readonly select: (value: string) => void
  readonly disabled: boolean
} | null>(null)

export type MenuRadioGroupProps = Omit<Own<"div">, "defaultValue"> & {
  readonly value?: string | null
  /** Initial selected value while uncontrolled. Default: null. */
  readonly defaultValue?: string | null
  readonly onValueChange?: (value: string | null) => void
  readonly disabled?: boolean
}

function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  render,
  children,
  ...rest
}: MenuRadioGroupProps) {
  const ctx = useLevel("RadioGroup")
  const { api } = useApi(ctx)
  const group = useMachine(menuRadioGroupMachine, {
    value,
    defaultValue,
    onValueChange: onValueChange ? (v) => onValueChange(v) : undefined,
    disabled,
  })
  const current = group.view.values.value ?? null
  const props = mergeProps(normalizeProps(api.radioGroup({ disabled })), {
    ...rest,
    children: (
      <RadioGroupContext
        value={{
          value: current,
          select: (v) => group.send({ type: "SELECT", value: v }),
          disabled,
        }}
      >
        {children}
      </RadioGroupContext>
    ),
  })
  return renderPart("div", props, render, undefined)
}

export type MenuRadioItemProps = Omit<Own<"div", MenuItemRenderState>, "onSelect"> &
  Omit<ItemBase, "value"> & {
    readonly value: string
    /** Default false. */
    readonly closeOnSelect?: boolean
  }

function RadioItem({
  value,
  textValue,
  disabled: ownDisabled = false,
  closeOnSelect = false,
  onSelect,
  render,
  ref,
  children,
  ...rest
}: MenuRadioItemProps) {
  const ctx = useLevel("RadioItem")
  const group = useContext(RadioGroupContext)
  if (!group) throw new Error("Menu.RadioItem must be inside Menu.RadioGroup")
  const disabled = ownDisabled || group.disabled
  const { api, view } = useApi(ctx)
  const el = useRef<HTMLElement | null>(null)
  const key = useItem(
    ctx,
    { value, textValue, disabled },
    { onSelect, activate: () => group.select(value) },
    el,
  )
  const checked = group.value === value
  const own = api.item(key, { kind: "radio-item", disabled, closeOnSelect, checked })
  const props = mergeProps(
    { ...normalizeProps(own), ref: composeRefs(el, ref) },
    { ...rest, children: <ItemContext value={{ checked }}>{children}</ItemContext> },
  )
  return renderPart("div", props, render, {
    highlighted: view.context.highlightedKey === key,
    disabled,
  })
}

export type MenuItemIndicatorProps = Own<"span"> & {
  /** Rendered while unchecked too (hidden by CSS on `data-state`). */
  readonly keepMounted?: boolean
}

function ItemIndicator({ keepMounted = false, render, ...rest }: MenuItemIndicatorProps) {
  const ctx = useLevel("ItemIndicator")
  const item = useContext(ItemContext)
  if (!item) throw new Error("Menu.ItemIndicator must be inside a checkbox or radio item")
  const { api } = useApi(ctx)
  if (!item.checked && !keepMounted) return null
  return renderPart(
    "span",
    mergeProps(normalizeProps(api.itemIndicator(item.checked)), rest),
    render,
    undefined,
  )
}

function ItemText({ render, ...rest }: Own<"span">) {
  const ctx = useLevel("ItemText")
  const { api } = useApi(ctx)
  return renderPart("span", mergeProps(normalizeProps(api.itemText()), rest), render, undefined)
}

const GroupContext = createContext<{
  readonly labelId: string
  readonly setLabelled: (on: boolean) => void
} | null>(null)

function Group({ render, children, ...rest }: Own<"div">) {
  const ctx = useLevel("Group")
  const { api } = useApi(ctx)
  const labelId = `${useId()}-label`
  const [labelled, setLabelled] = useState(false)
  const props = mergeProps(normalizeProps(api.group(labelled ? labelId : undefined)), {
    ...rest,
    children: <GroupContext value={{ labelId, setLabelled }}>{children}</GroupContext>,
  })
  return renderPart("div", props, render, undefined)
}

function GroupLabel({ render, ...rest }: Own<"div">) {
  const ctx = useLevel("GroupLabel")
  const group = useContext(GroupContext)
  if (!group) throw new Error("Menu.GroupLabel must be inside Menu.Group")
  const { api } = useApi(ctx)
  const { setLabelled } = group
  useIsoLayoutEffect(() => {
    setLabelled(true)
    return () => setLabelled(false)
  }, [setLabelled])
  return renderPart(
    "div",
    mergeProps(normalizeProps(api.groupLabel(group.labelId)), rest),
    render,
    undefined,
  )
}

export type MenuSeparatorProps = Own<"div"> & {
  /** Default: perpendicular to the menu (horizontal in a vertical menu). */
  readonly orientation?: "horizontal" | "vertical"
}

function Separator({ orientation, render, ref, ...rest }: MenuSeparatorProps) {
  const ctx = useLevel("Separator")
  const { api } = useApi(ctx)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("div", render, el)
  const props = mergeProps(
    { ...normalizeProps(api.separator({ orientation, tag })), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart("div", props, render, undefined)
}

const SubmenuContext = createContext<{
  readonly parent: Level
  readonly key: CollectionKey
  readonly triggerRef: RefObject<HTMLElement | null>
  /** The SubmenuTrigger's `disabled`: the expand key never opens a disabled submenu. */
  readonly disabledRef: RefObject<boolean>
} | null>(null)

export type MenuSubmenuProps = Omit<LevelOptions, "loop"> & {
  readonly loop?: boolean
  /** The submenu's parts: its `Menu.SubmenuTrigger` and its portal, positioner and content. */
  readonly children?: ReactNode
}

function Submenu({ children, ...options }: MenuSubmenuProps) {
  const parent = useLevel("Submenu")
  const levelId = menuLevelId(useRootId())
  const key = toKey(`${levelId}-trigger`)
  const triggerRef = useRef<HTMLElement | null>(null)
  const s = useLevelService({
    level: "submenu",
    levelId,
    parentLevel: parent.levelId,
    tree: parent.tree,
    triggerRef,
    options,
    hoverIntent: parent.hoverIntent,
  })
  const { submenus } = parent
  const { send } = s
  const disabledRef = useRef(false)
  useIsoLayoutEffect(() => {
    submenus.set(key, () => {
      if (!disabledRef.current) send({ type: "SUB_OPEN" })
    })
    return () => {
      submenus.delete(key)
    }
  }, [submenus, key, send])
  const [contentMounted, setContentMounted] = useState(false)
  const ctx: Level = {
    service: s.service,
    levelId,
    level: "submenu",
    props: s.props,
    tree: parent.tree,
    keepMounted: parent.keepMounted,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    triggerRef,
    contentMounted,
    setContentMounted,
    labelledBy: menuIds(parent.levelId).item(key),
    inMenubar: false,
  }
  return (
    <SubmenuContext value={{ parent, key, triggerRef, disabledRef }}>
      <LevelContext value={ctx}>{children}</LevelContext>
    </SubmenuContext>
  )
}

export type MenuSubmenuTriggerProps = Own<"div", MenuItemRenderState> & {
  readonly textValue?: string
  readonly disabled?: boolean
}

function SubmenuTrigger({
  textValue,
  disabled = false,
  render,
  ref,
  ...rest
}: MenuSubmenuTriggerProps) {
  const sub = useContext(SubmenuContext)
  const child = useLevel("SubmenuTrigger")
  if (!sub) throw new Error("Menu.SubmenuTrigger must be inside Menu.Submenu")
  const env = useEnvironment()
  const { api, view } = useApi(sub.parent)
  const childOpen = useSelector(child.service, (v) => v.matches("open"))
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(sub.parent.registry, { key: sub.key, textValue, disabled }, el)
  const { disabledRef } = sub
  useIsoLayoutEffect(() => {
    disabledRef.current = disabled
  }, [disabledRef, disabled])
  const [focused, setFocused] = useState(false)
  const hover = useMemo(
    () => child.hoverIntent.triggerProps((e) => child.service.send(e)),
    [child.hoverIntent, child.service],
  )
  const own = api.submenuTrigger(sub.key, {
    disabled,
    focused,
    open: childOpen,
    contentId: menuIds(child.levelId).content,
    contentMounted: child.contentMounted,
  })
  const props = mergeProps(
    {
      ...joinHandlers(
        normalizeProps(own),
        disabled
          ? {}
          : { onPointerMove: hover.onPointerMove, onPointerLeave: hover.onPointerLeave },
        {
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onClick: (e: { preventDefault(): void }) => {
            if (disabled) {
              e.preventDefault()
              return
            }
            // Pointer, assistive technology, and Enter / Space (the level clicks the item).
            child.service.send({ type: "TRIGGER_PRESS", modality: env.modality.modality() })
          },
        },
      ),
      ref: composeRefs(el, composeRefs(sub.triggerRef, ref)),
    },
    rest,
  )
  return renderPart("div", props, render, {
    highlighted: view.context.highlightedKey === sub.key,
    disabled,
  })
}

function Portal(props: PortalProps) {
  const ctx = useLevel("Portal")
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => ctx.triggerRef.current
  return <PortalPart logicalParent={logicalParent} {...props} />
}

export const Menu = {
  Root,
  Trigger,
  Portal,
  Positioner,
  Content,
  Arrow,
  Item,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  ItemIndicator,
  ItemText,
  Group,
  GroupLabel,
  Separator,
  Submenu,
  SubmenuTrigger,
}

// Internal: a context menu builds its root level from these (not public API).
export {
  type Level as MenuLevel,
  LevelContext as MenuLevelContext,
  type LevelOptions as MenuLevelOptions,
  useApi as useMenuApi,
  useLevelService as useMenuLevelService,
}
