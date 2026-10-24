import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  createMenuTree,
  domHoverIntent,
  domPositioning,
  getLayerStack,
  type HoverIntent,
  type LayerMeta,
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
  type RouterOptions,
  type Service,
  toggleMachine,
  toKey,
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment } from "../provider"
import { asChildProp, elements, renderedTag, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

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

/** `select`'s details: `cancel()` keeps the menu open. */
export interface MenuSelectDetails {
  readonly key: CollectionKey
  readonly kind: MenuItemKind
  readonly modality: MenuActivation["modality"]
  cancel(): void
}

/** What an item does on activation (its own state first, then `select`). */
interface Activation {
  readonly activate?: ((a: MenuActivation) => void) | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}

/** A menubar hosting a root level (add-menubar). */
export interface MenuHost {
  readonly parentKind: MenuParentKind
  readonly host?: MenuTreeHost | undefined
  /** The bar's roving tabindex for this trigger. */
  readonly tabIndex?: () => number | undefined
  /** The bar's item key for this trigger. */
  readonly key?: () => CollectionKey | undefined
}

/** Provided by a menubar around its menus (add-menubar). */
export const MenuHostKey: InjectionKey<MenuHost | null> = Symbol("rind-ui.menu-host")

type View = ReturnType<Service<typeof menuMachine>["view"]>

/** One level of a menu tree: internal (a context menu builds its root level from it). */
export interface MenuLevel {
  readonly service: Service<typeof menuMachine>
  readonly view: ComputedRef<View>
  readonly levelId: MenuLevelId
  readonly level: "root" | "submenu"
  readonly props: () => MenuProps
  readonly tree: MenuTree
  readonly keepMounted: () => boolean
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly activations: Map<CollectionKey, Activation>
  readonly submenus: Map<CollectionKey, () => void>
  readonly hoverIntent: HoverIntent
  readonly trigger: ShallowRef<HTMLElement | null>
  readonly contentMounted: ShallowRef<boolean>
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: ShallowRef<LayerMeta | undefined>
  /** A submenu's content is named by its trigger item. */
  readonly labelledBy?: string | undefined
  readonly inMenubar: boolean
  /** A context menu: the trigger is a region. */
  readonly region?: boolean | undefined
}

export const MenuLevelKey: InjectionKey<MenuLevel> = Symbol("rind-ui.menu-level")
function useLevel(part: string): MenuLevel {
  const ctx = inject(MenuLevelKey, null)
  if (!ctx) throw new Error(`Menu.${part} must be inside Menu.Root`)
  return ctx
}

/** The level's connect: call during render. */
export function menuApi(
  ctx: MenuLevel,
  env: ReturnType<typeof useEnvironment>,
  extra: { dir?: "ltr" | "rtl" } = {},
) {
  const view = ctx.view.value
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
      contentMounted: ctx.contentMounted.value,
      labelledBy: ctx.labelledBy,
      meta: ctx.meta.value,
      manual: menuPositioning(props).mode === "manual",
      inMenubar: ctx.inMenubar,
      region: ctx.region,
      ...extra,
    },
    ctx.service.send,
    env,
  )
}

const isOpen = (ctx: MenuLevel) => ctx.view.value.matches("open")

/** A level's options, shared by Root and Submenu. */
export const levelOptionProps = {
  /** Arrow navigation wraps from the last item to the first and back. Default: true. */
  loop: { type: Boolean, default: undefined },
  /** Disabled items stay reachable by navigation (they still cannot be activated). Default: true. */
  focusableWhenDisabled: { type: Boolean, default: undefined },
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  typeaheadTimeout: Number,
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
  positioning: Object as PropType<PositioningProps>,
  /** Milliseconds the pointer rests on a submenu trigger before it opens. Default: 100. */
  submenuOpenDelay: Number,
  /** Milliseconds the pointer may rest inside the grace area towards an open submenu before it closes. Default: 300. */
  submenuGraceTimeout: Number,
} as const

export interface MenuLevelOptions {
  readonly loop: boolean | undefined
  readonly focusableWhenDisabled: boolean | undefined
  readonly typeaheadTimeout: number | undefined
  readonly positioning: PositioningProps | undefined
  readonly submenuOpenDelay: number | undefined
  readonly submenuGraceTimeout: number | undefined
}

/** One level's service, its items, its tree registration and its registries: internal. Call in setup. */
export function useMenuLevelService(input: {
  readonly level: "root" | "submenu"
  readonly levelId: MenuLevelId
  readonly parentLevel?: MenuLevelId | undefined
  readonly tree: MenuTree
  readonly trigger: ShallowRef<HTMLElement | null>
  readonly options: () => MenuLevelOptions
  readonly controllable?: () => Pick<MenuProps, "open" | "defaultOpen" | "onOpenChange" | "modal">
  /** One per tree: a parent level sees its submenu's transit (the grace area). */
  readonly hoverIntent?: HoverIntent | undefined
  /** A context menu's root level. */
  readonly region?: () => Pick<MenuProps, "onAnchorChange">
}) {
  const env = useEnvironment(announcerCapability, layoutCapability)
  const parent = useParentLayer()
  const { collection: registered, registry } = useCollectionItems()
  const hoverIntent = input.hoverIntent ?? domHoverIntent(env)
  const menuEnv = { ...env, position: domPositioning(env), hoverIntent, menuTree: input.tree }
  const activations = new Map<CollectionKey, Activation>()
  const submenus = new Map<CollectionKey, () => void>()
  const m = menuIds(input.levelId)
  const ids = { list: m.content, item: m.item }
  const props = (): MenuProps => {
    const o = input.options()
    return {
      ...(input.region ? { region: true, onAnchorChange: input.region().onAnchorChange } : {}),
      ...input.controllable?.(),
      collection: registered.value ?? EMPTY,
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
      getTrigger: () => input.trigger.value,
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
        // A modal menu keeps the page inert until it closes: a focus move `select` made
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
  }
  const { service, send, view } = useMachine(menuMachine, props, menuEnv)
  const meta = shallowRef<LayerMeta | undefined>(undefined)
  onMounted(() =>
    watch(
      () => view.value.matches("open"),
      (open, _, onCleanup) => {
        meta.value = undefined
        if (!open) return
        const node = env.dom.getRootNode()
        const stack = getLayerStack("body" in node ? node : node.ownerDocument)
        const read = () => (meta.value = stack.get(menuLayerId(input.levelId))?.meta())
        read()
        onCleanup(stack.subscribe(read))
      },
      { immediate: true },
    ),
  )
  return { service, send, view, props, registry, activations, submenus, hoverIntent, meta }
}

/** What the Root's template ref exposes. */
export interface MenuActions {
  open(): void
  close(): void
}

export interface MenuTriggerState {
  readonly open: boolean
}

export interface MenuContentState {
  readonly open: boolean
}

export interface MenuItemRenderState {
  readonly highlighted: boolean
  readonly disabled: boolean
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "MenuRoot",
  props: {
    ...levelOptionProps,
    /** Base for the ids of the menu's parts. Default: generated. */
    id: String,
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default true: everything outside is inert and an outside press only closes the menu. */
    modal: { type: Boolean, default: true },
    /** Positioner and content stay mounted (hidden) while closed. */
    keepMounted: Boolean,
  },
  emits: {
    openChange: (_open: boolean, _details: MenuChangeDetails) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const levelId = menuLevelId(useRootId(() => props.id)())
    const host = inject(MenuHostKey, null)
    const tree = createMenuTree({
      ...(host ? { parentKind: host.parentKind } : {}),
      ...(host?.host ? { host: host.host } : {}),
    })
    const trigger = shallowRef<HTMLElement | null>(null)
    // As changeEmitter, for the menu's own details type (its reasons are the menu's).
    const onOpenChange = (v: boolean, d: MenuChangeDetails) => {
      let cancelled = false
      emit("openChange", v, {
        ...d,
        cancel() {
          cancelled = true
          d.cancel()
        },
      })
      if (!cancelled) emit("update:open", v)
    }
    const s = useMenuLevelService({
      level: "root",
      levelId,
      tree,
      trigger,
      options: () => props,
      controllable: () => ({
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange,
        modal: props.modal,
      }),
    })
    expose({
      open: () => s.send({ type: "OPEN" }),
      close: () => s.send({ type: "CLOSE" }),
    } satisfies MenuActions)
    const ctx: MenuLevel = {
      service: s.service,
      view: s.view,
      levelId,
      level: "root",
      props: s.props,
      tree,
      keepMounted: () => props.keepMounted,
      registry: s.registry,
      activations: s.activations,
      submenus: s.submenus,
      hoverIntent: s.hoverIntent,
      trigger,
      contentMounted: shallowRef(false),
      meta: s.meta,
      inMenubar: host?.parentKind === "menubar",
    }
    provide(MenuLevelKey, ctx)
    return () => slots.default?.({ open: isOpen(ctx) })
  },
})

/** A part's element, kept as the level's trigger too (positioning, the portal's parent). */
function triggerRef(ctx: MenuLevel, el: ShallowRef<Element | null>) {
  return (node: unknown) => {
    refTo(el)(node)
    ctx.trigger.value = el.value instanceof HTMLElement ? el.value : null
  }
}

const Trigger = defineComponent({
  name: "MenuTrigger",
  inheritAttrs: false,
  props: { disabled: Boolean, ...asChildProp },
  slots: Object as Slots<MenuTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Trigger")
    const host = inject(MenuHostKey, null)
    const env = useEnvironment()
    // The modality tracker needs a subscriber while the trigger is mounted.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      send: (e) => {
        if (e.type !== "PRESS") return
        // A menubar opens its menus itself (one open menu per bar).
        const key = host?.key?.()
        if (ctx.inMenubar && key !== undefined) ctx.tree.parentPress(key, e.modality)
        else menuApi(ctx, env).pressTrigger(e.modality)
      },
      disabled: () => props.disabled,
      // A label's forwarded click focuses the trigger and never opens the menu.
      labelActivation: "focus",
    })
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    const setEl = triggerRef(ctx, el)
    return () => {
      const fallback = ctx.inMenubar ? "div" : "button"
      const children = slots.default?.({ open: isOpen(ctx) })
      const tag = renderedTag(fallback, children, props.asChild, measured.value)
      const own = normalizeProps(
        menuApi(ctx, env).trigger({
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          tag,
          disabled: props.disabled,
          tabIndex: host?.tabIndex?.(),
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, press.props, {
            onFocus: () => (focused.value = true),
            onBlur: () => (focused.value = false),
          }),
          ref: setEl,
        },
        attrs,
      )
      return renderPart(fallback, merged, children, props.asChild)
    }
  },
})

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: MenuLevel) {
  const dir = shallowRef<"ltr" | "rtl" | undefined>(undefined)
  onMounted(() =>
    watch(
      () => isOpen(ctx),
      (open) => {
        if (!open) return
        const found = ctx.trigger.value?.closest("[dir]")?.getAttribute("dir")
        dir.value = found === "rtl" ? "rtl" : "ltr"
      },
      { immediate: true, flush: "post" },
    ),
  )
  return dir
}

const Positioner = defineComponent({
  name: "MenuPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Positioner")
    const env = useEnvironment()
    const dir = useTriggerDir(ctx)
    const el = shallowRef<Element | null>(null)
    // It holds the content: it stays while the content's exit animations run.
    const presence = usePresence(() => isOpen(ctx), el, {
      keepMounted: ctx.keepMounted,
      subtree: () => true,
    })
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(menuApi(ctx, env, dir.value ? { dir: dir.value } : {}).positioner()),
          hidden: !isOpen(ctx) && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Content = defineComponent({
  name: "MenuContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<MenuContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Content")
    const env = useEnvironment()
    // Layers opened from here (submenus, dialogs from items) are this level's children.
    provideLayer(
      () => menuLayerId(ctx.levelId),
      () => "menu",
    )
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => isOpen(ctx), el, { keepMounted: ctx.keepMounted })
    // The scroll lock writes to this element's style too.
    const kept = keepStyle()
    onMounted(() =>
      watch(
        () => (presence.mounted ? el.value : null),
        (node, _, onCleanup) => {
          ctx.contentMounted.value = node !== null
          if (node) onCleanup(() => (ctx.contentMounted.value = false))
        },
        { immediate: true, flush: "post" },
      ),
    )
    // Any other element directly inside the menu is presentational for the menu role.
    const presentational = () => {
      for (const child of el.value?.children ?? []) {
        if (
          !child.hasAttribute("data-scope") &&
          !child.hasAttribute("role") &&
          !child.matches(INTERACTIVE)
        ) {
          child.setAttribute("role", "none")
        }
      }
    }
    onMounted(presentational)
    onUpdated(presentational)
    return () => {
      if (!presence.mounted) return null
      const open = isOpen(ctx)
      const exiting = !open && presence.state === "exiting"
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      const merged = mergeProps(
        {
          ...normalizeProps(
            menuApi(ctx, env).content({
              label: label as string | undefined,
              labelledBy: labelledBy as string | undefined,
            }),
          ),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
          ref: refTo(el),
        },
        rest,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.({ open }), props.asChild))
    }
  },
})

const Arrow = defineComponent({
  name: "MenuArrow",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Arrow")
    const env = useEnvironment()
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(menuApi(ctx, env).arrow()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** The item's checked state, for its indicator. */
const ItemKey: InjectionKey<{ readonly checked: () => boolean }> = Symbol("rind-ui.menu-item")

/** Registers an item and its activation with the level; the item's key. Call in setup. */
function useItem(
  ctx: MenuLevel,
  item: () => { value?: string | undefined; textValue?: string | undefined; disabled: boolean },
  activation: () => Activation,
  el: ShallowRef<Element | null>,
): () => CollectionKey {
  const generated = useId()
  const key = () => toKey(item().value ?? generated)
  useRegisterItem(
    ctx.registry,
    () => ({ key: key(), textValue: item().textValue, disabled: item().disabled }),
    el,
  )
  onMounted(() =>
    watch(
      key,
      (k, _, onCleanup) => {
        ctx.activations.set(k, {
          activate: (a) => activation().activate?.(a),
          onSelect: (d) => activation().onSelect?.(d),
        })
        onCleanup(() => ctx.activations.delete(k))
      },
      { immediate: true },
    ),
  )
  onBeforeUnmount(() => ctx.activations.delete(key()))
  return key
}

const itemBaseProps = {
  /** The item's key (default: generated). */
  value: String,
  /** Typeahead text (default: the text content). */
  textValue: String,
  disabled: Boolean,
  ...asChildProp,
} as const

const itemEmits = {
  /** The item was activated; `details.cancel()` keeps the menu open. */
  select: (_details: MenuSelectDetails) => true,
}

const Item = defineComponent({
  name: "MenuItem",
  inheritAttrs: false,
  props: {
    ...itemBaseProps,
    /** Default true: activating the item closes the menu tree. */
    closeOnSelect: { type: Boolean, default: true },
    /** A link item (rendered as `<a>`). */
    href: String as PropType<LinkInput["href"]>,
    /** The link's `target`; a target other than `_self` leaves navigation to the browser. */
    target: String,
    /** The link's `rel`. */
    rel: String,
    /** The link's `download`: `true` or a file name; the browser downloads instead of navigating. */
    download: { type: [Boolean, String], default: undefined },
    /** Passed unchanged to the router's `navigate`. */
    // Any value: RouterOptions is `never` until the app augments RouterConfig.
    routerOptions: null as unknown as PropType<RouterOptions>,
  },
  emits: itemEmits,
  slots: Object as Slots<MenuItemRenderState>,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevel("Item")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    const key = useItem(
      ctx,
      () => props,
      () => ({ onSelect: (d) => emit("select", d) }),
      el,
    )
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const link = props.href !== undefined
      const children = slots.default?.({
        highlighted: ctx.view.value.context.highlightedKey === key(),
        disabled: props.disabled,
      })
      const fallback = link ? "a" : "div"
      const tag = renderedTag(fallback, children, props.asChild, measured.value)
      const api = menuApi(ctx, env)
      // A rendered component (a router's Link) navigates itself.
      const child = props.asChild ? elements(children ?? null)[0] : undefined
      const linkEnv =
        child !== undefined && typeof child.type !== "string" ? { ...env, router: undefined } : env
      const linkPart = link
        ? linkProps(
            {
              href: props.href,
              target: props.target,
              rel: props.rel,
              download: props.download,
              routerOptions: props.routerOptions,
              disabled: props.disabled,
              focusableWhenDisabled: true,
              origin: typeof location === "undefined" ? undefined : location.origin,
              tag,
              onActivate: (a) => {
                if (a.disposition === "same-tab") {
                  api.activateLink(key(), a.modality, props.closeOnSelect)
                }
              },
            },
            linkEnv,
          )
        : {}
      // The menu owns the role, focus and highlight; the link part only its navigation.
      const { role: _role, tabindex: _tabindex, ...navigation } = linkPart
      const own = api.item(key(), {
        kind: link ? "link-item" : "item",
        disabled: props.disabled,
        closeOnSelect: props.closeOnSelect,
      })
      const merged = mergeProps(
        { ...joinHandlers(normalizeProps(own), normalizeProps(navigation)), ref: refTo(el) },
        attrs,
      )
      return renderPart(fallback, merged, children, props.asChild)
    }
  },
})

const CheckboxItem = defineComponent({
  name: "MenuCheckboxItem",
  inheritAttrs: false,
  props: {
    ...itemBaseProps,
    /** Controlled checked state (`v-model:checked`). */
    checked: { type: Boolean, default: undefined },
    /** Initial checked state while uncontrolled. Default: false. */
    defaultChecked: { type: Boolean, default: undefined },
    /** Default false: the menu stays open while options are toggled. */
    closeOnSelect: { type: Boolean, default: false },
  },
  emits: {
    ...itemEmits,
    /** The new checked state, each time the item is toggled. */
    checkedChange: (_checked: boolean) => true,
    "update:checked": (_checked: boolean) => true,
  },
  slots: Object as Slots<MenuItemRenderState>,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevel("CheckboxItem")
    const env = useEnvironment()
    const toggle = useMachine(toggleMachine, () => ({
      pressed: props.checked,
      defaultPressed: props.defaultChecked,
      onPressedChange: (p: boolean) => {
        emit("checkedChange", p)
        emit("update:checked", p)
      },
    }))
    const on = () => toggle.view.value.values.pressed === true
    provide(ItemKey, { checked: on })
    const el = shallowRef<Element | null>(null)
    const key = useItem(
      ctx,
      () => props,
      () => ({
        onSelect: (d) => emit("select", d),
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
      }),
      el,
    )
    return () => {
      const own = menuApi(ctx, env).item(key(), {
        kind: "checkbox-item",
        disabled: props.disabled,
        closeOnSelect: props.closeOnSelect,
        checked: on(),
      })
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(own), ref: refTo(el) }, attrs),
        slots.default?.({
          highlighted: ctx.view.value.context.highlightedKey === key(),
          disabled: props.disabled,
        }),
        props.asChild,
      )
    }
  },
})

const RadioGroupKey: InjectionKey<{
  readonly value: () => string | null
  readonly select: (value: string) => void
  readonly disabled: () => boolean
}> = Symbol("rind-ui.menu-radio-group")

const RadioGroup = defineComponent({
  name: "MenuRadioGroup",
  inheritAttrs: false,
  props: {
    /** Controlled selected value (`v-model`). */
    modelValue: { type: String as PropType<string | null>, default: undefined },
    /** Initial selected value while uncontrolled. Default: null. */
    defaultValue: { type: String as PropType<string | null>, default: undefined },
    disabled: Boolean,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string | null) => true,
    "update:modelValue": (_value: string | null) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevel("RadioGroup")
    const env = useEnvironment()
    const group = useMachine(menuRadioGroupMachine, () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (v: string | null) => {
        emit("valueChange", v)
        emit("update:modelValue", v)
      },
      disabled: props.disabled,
    }))
    provide(RadioGroupKey, {
      value: () => group.view.value.values.value ?? null,
      select: (v) => group.send({ type: "SELECT", value: v }),
      disabled: () => props.disabled,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          normalizeProps(menuApi(ctx, env).radioGroup({ disabled: props.disabled })),
          attrs,
        ),
        slots.default?.(),
        props.asChild,
      )
  },
})

const RadioItem = defineComponent({
  name: "MenuRadioItem",
  inheritAttrs: false,
  props: {
    ...itemBaseProps,
    value: { type: String, required: true },
    /** Default false. */
    closeOnSelect: { type: Boolean, default: false },
  },
  emits: itemEmits,
  slots: Object as Slots<MenuItemRenderState>,
  setup(props, { attrs, slots, emit }) {
    const ctx = useLevel("RadioItem")
    const env = useEnvironment()
    const group = inject(RadioGroupKey, null)
    if (!group) throw new Error("Menu.RadioItem must be inside Menu.RadioGroup")
    const disabled = () => props.disabled || group.disabled()
    const checked = () => group.value() === props.value
    provide(ItemKey, { checked })
    const el = shallowRef<Element | null>(null)
    const key = useItem(
      ctx,
      () => ({ value: props.value, textValue: props.textValue, disabled: disabled() }),
      () => ({ onSelect: (d) => emit("select", d), activate: () => group.select(props.value) }),
      el,
    )
    return () => {
      const own = menuApi(ctx, env).item(key(), {
        kind: "radio-item",
        disabled: disabled(),
        closeOnSelect: props.closeOnSelect,
        checked: checked(),
      })
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(own), ref: refTo(el) }, attrs),
        slots.default?.({
          highlighted: ctx.view.value.context.highlightedKey === key(),
          disabled: disabled(),
        }),
        props.asChild,
      )
    }
  },
})

const ItemIndicator = defineComponent({
  name: "MenuItemIndicator",
  inheritAttrs: false,
  props: {
    /** Rendered while unchecked too (hidden by CSS on `data-state`). */
    keepMounted: Boolean,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("ItemIndicator")
    const env = useEnvironment()
    const item = inject(ItemKey, null)
    if (!item) throw new Error("Menu.ItemIndicator must be inside a checkbox or radio item")
    return () => {
      const checked = item.checked()
      if (!checked && !props.keepMounted) return null
      return renderPart(
        "span",
        mergeProps(normalizeProps(menuApi(ctx, env).itemIndicator(checked)), attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

const ItemText = defineComponent({
  name: "MenuItemText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("ItemText")
    const env = useEnvironment()
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(menuApi(ctx, env).itemText()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const GroupKey: InjectionKey<{
  readonly labelId: string
  readonly setLabelled: (on: boolean) => void
}> = Symbol("rind-ui.menu-group")

const Group = defineComponent({
  name: "MenuGroup",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Group")
    const env = useEnvironment()
    const labelId = `${useId()}-label`
    const labelled = shallowRef(false)
    provide(GroupKey, { labelId, setLabelled: (on) => (labelled.value = on) })
    return () =>
      renderPart(
        "div",
        mergeProps(
          normalizeProps(menuApi(ctx, env).group(labelled.value ? labelId : undefined)),
          attrs,
        ),
        slots.default?.(),
        props.asChild,
      )
  },
})

const GroupLabel = defineComponent({
  name: "MenuGroupLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("GroupLabel")
    const env = useEnvironment()
    const group = inject(GroupKey, null)
    if (!group) throw new Error("Menu.GroupLabel must be inside Menu.Group")
    onMounted(() => group.setLabelled(true))
    onBeforeUnmount(() => group.setLabelled(false))
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(menuApi(ctx, env).groupLabel(group.labelId)), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Separator = defineComponent({
  name: "MenuSeparator",
  inheritAttrs: false,
  props: {
    /** Default: perpendicular to the menu (horizontal in a vertical menu). */
    orientation: String as PropType<"horizontal" | "vertical">,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useLevel("Separator")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default?.()
      const tag = renderedTag("div", children, props.asChild, measured.value)
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(menuApi(ctx, env).separator({ orientation: props.orientation, tag })),
            ref: refTo(el),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

const SubmenuKey: InjectionKey<{
  readonly parent: MenuLevel
  readonly key: CollectionKey
  readonly trigger: ShallowRef<HTMLElement | null>
  /** The SubmenuTrigger's `disabled`: the expand key never opens a disabled submenu. */
  readonly disabled: { current: boolean }
}> = Symbol("rind-ui.menu-submenu")

const Submenu = defineComponent({
  name: "MenuSubmenu",
  props: { ...levelOptionProps },
  slots: Object as Slots,
  setup(props, { slots }) {
    const parent = useLevel("Submenu")
    const levelId = menuLevelId(useRootId(() => undefined)())
    const key = toKey(`${levelId}-trigger`)
    const trigger = shallowRef<HTMLElement | null>(null)
    const s = useMenuLevelService({
      level: "submenu",
      levelId,
      parentLevel: parent.levelId,
      tree: parent.tree,
      trigger,
      options: () => props,
      hoverIntent: parent.hoverIntent,
    })
    const disabled = { current: false }
    onMounted(() =>
      parent.submenus.set(key, () => {
        if (!disabled.current) s.send({ type: "SUB_OPEN" })
      }),
    )
    onBeforeUnmount(() => parent.submenus.delete(key))
    provide(SubmenuKey, { parent, key, trigger, disabled })
    provide(MenuLevelKey, {
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
      contentMounted: shallowRef(false),
      meta: s.meta,
      labelledBy: menuIds(parent.levelId).item(key),
      inMenubar: false,
    })
    return () => slots.default?.()
  },
})

const SubmenuTrigger = defineComponent({
  name: "MenuSubmenuTrigger",
  inheritAttrs: false,
  props: { textValue: String, disabled: Boolean, ...asChildProp },
  slots: Object as Slots<MenuItemRenderState>,
  setup(props, { attrs, slots }) {
    const sub = inject(SubmenuKey, null)
    const child = useLevel("SubmenuTrigger")
    if (!sub) throw new Error("Menu.SubmenuTrigger must be inside Menu.Submenu")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    useRegisterItem(
      sub.parent.registry,
      () => ({ key: sub.key, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    watch(
      () => props.disabled,
      (d) => (sub.disabled.current = d),
      { immediate: true },
    )
    const focused = shallowRef(false)
    const hover = child.hoverIntent.triggerProps((e) => child.service.send(e))
    const setEl = (node: unknown) => {
      refTo(el)(node)
      sub.trigger.value = el.value instanceof HTMLElement ? el.value : null
    }
    return () => {
      const own = menuApi(sub.parent, env).submenuTrigger(sub.key, {
        disabled: props.disabled,
        focused: focused.value,
        open: isOpen(child),
        contentId: menuIds(child.levelId).content,
        contentMounted: child.contentMounted.value,
      })
      const merged = mergeProps(
        {
          ...joinHandlers(
            normalizeProps(own),
            props.disabled
              ? {}
              : normalizeProps({
                  onPointerMove: hover.onPointerMove,
                  onPointerLeave: hover.onPointerLeave,
                }),
            {
              onFocus: () => (focused.value = true),
              onBlur: () => (focused.value = false),
              onClick: (e: MouseEvent) => {
                if (props.disabled) {
                  e.preventDefault()
                  return
                }
                // Pointer, assistive technology, and Enter / Space (the level clicks the item).
                child.service.send({ type: "TRIGGER_PRESS", modality: env.modality.modality() })
              },
            },
          ),
          ref: setEl,
        },
        attrs,
      )
      return renderPart(
        "div",
        merged,
        slots.default?.({
          highlighted: sub.parent.view.value.context.highlightedKey === sub.key,
          disabled: props.disabled,
        }),
        props.asChild,
      )
    }
  },
})

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
const Portal = defineComponent({
  name: "MenuPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useLevel("Portal")
    const logicalParent = () => ctx.trigger.value
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

/** The parts, by name: `menu.parts.ts` re-exports them as the `Menu` namespace. */
export {
  Arrow,
  CheckboxItem,
  Content,
  Group,
  GroupLabel,
  Item,
  ItemIndicator,
  ItemText,
  Portal,
  Positioner,
  RadioGroup,
  RadioItem,
  Root,
  Separator,
  Submenu,
  SubmenuTrigger,
  Trigger,
}
