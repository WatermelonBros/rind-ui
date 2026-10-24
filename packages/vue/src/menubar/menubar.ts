// Menubar parts (design §7): Root (the bar's service, its item registry and the port to its
// menus), Menu (an ordinary Menu root level hosted by the bar) and Trigger (the menu's trigger
// in menubar mode, plus the bar's roving wiring). Inside a menu, the Menu parts.
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type MenubarMenus,
  type MenubarOpening,
  type MenubarValueReason,
  type MenuChangeDetails,
  type MenuCloseReason,
  menubarConnect,
  menubarMachine,
  menuIds,
  positioningPresets,
  toKey,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { levelOptionProps, type MenuHost, MenuHostKey, MenuLevelKey } from "../menu/menu"
import * as Menu from "../menu/menu.parts"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** One menu level, as the bar drives it. */
interface MenuHandle {
  isOpen(): boolean
  send(event: { type: "TRIGGER_PRESS"; modality: MenubarOpening["modality"] }): void
  send(event: { type: "TRIGGER_KEY"; key: "first" | "last" }): void
  send(event: { type: "CLOSE" } | { type: "TREE.SIBLING_OPENED" }): void
}

interface Bar {
  readonly instance: () => string
  readonly api: () => ReturnType<typeof menubarConnect>
  readonly send: ReturnType<typeof useMachine<typeof menubarMachine>>["send"]
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly handles: Map<CollectionKey, MenuHandle>
  /** Closes the bar itself causes: not reported back as MENU_CLOSED. */
  readonly closing: Set<CollectionKey>
  readonly root: ShallowRef<Element | null>
  readonly orientation: () => "horizontal" | "vertical"
  readonly modal: () => boolean
  readonly disabled: () => boolean
  readonly claimFirst: (key: CollectionKey) => boolean
}

const BarKey: InjectionKey<Bar> = Symbol("rind-ui.menubar")
function useBar(part: string): Bar {
  const bar = inject(BarKey, null)
  if (!bar) throw new Error(`Menubar.${part} must be inside Menubar.Root`)
  return bar
}

/** The menu's level id: its trigger's element id is the bar item's (ids.item). */
const levelOf = (instance: string, key: string) => `${instance}-menu-${key}`

/** What the Root's template ref exposes. */
export interface MenubarActions {
  /** Focuses the bar's tab stop (for an application shortcut such as F10). */
  focus(): void
}

export interface MenubarState {
  readonly open: boolean
  readonly orientation: "horizontal" | "vertical"
}

const Root = defineComponent({
  name: "MenubarRoot",
  inheritAttrs: false,
  props: {
    /** The open menu's value, or null (`v-model`). */
    modelValue: { type: String as PropType<string | null>, default: undefined },
    defaultValue: { type: String as PropType<string | null>, default: undefined },
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    /** Arrow moves wrap at both ends (default true). */
    loop: { type: Boolean, default: true },
    /** Default true: passed to every menu. */
    modal: { type: Boolean, default: true },
    disabled: Boolean,
    /** Disabled items stay focusable and reachable by arrows (default true). */
    focusableWhenDisabled: { type: Boolean, default: true },
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (
      _value: string | null,
      _details: { readonly reason: MenubarValueReason; readonly event: unknown },
    ) => true,
    "update:modelValue": (_value: string | null) => true,
  },
  slots: Object as SlotsType<{ default?: (state: MenubarState) => VNodeChild }>,
  setup(props, { attrs, slots, emit, expose }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const { collection: registered, registry } = useCollectionItems()
    const handles = new Map<CollectionKey, MenuHandle>()
    const closing = new Set<CollectionKey>()
    // The port to the menus: idempotent (a parent's value may repeat what already happened).
    const menus: MenubarMenus = {
      open(key, how) {
        const h = handles.get(key)
        // A reopened menu reports its next close again (a mark its last close left behind).
        closing.delete(key)
        if (!h || h.isOpen()) return
        if (how.edge) h.send({ type: "TRIGGER_KEY", key: how.edge })
        else h.send({ type: "TRIGGER_PRESS", modality: how.modality })
      },
      close(key, { switching }) {
        const h = handles.get(key)
        if (!h?.isOpen()) return
        // Cleared by the menu's openChange, which may run after this returns; at once when the
        // menu did not close (nothing will be reported), and by the next open otherwise.
        closing.add(key)
        h.send(switching ? { type: "TREE.SIBLING_OPENED" } : { type: "CLOSE" })
        if (h.isOpen()) closing.delete(key)
      },
    }
    const ids = {
      list: `${instance()}-menubar`,
      item: (key: CollectionKey) => menuIds(levelOf(instance(), key)).trigger,
    }
    const { view, send } = useMachine(
      menubarMachine,
      () => ({
        collection: registered.value ?? EMPTY,
        strategy: "roving" as const,
        ids,
        loop: props.loop,
        // Disabled items stay reachable by the bar's arrows and typeahead unless `false`;
        // keyboard switching between open menus skips them either way.
        focusableWhenDisabled: props.focusableWhenDisabled,
        orientation: props.orientation,
        modal: props.modal,
        disabled: props.disabled,
        menus,
        ...(props.modelValue !== undefined ? { value: props.modelValue } : {}),
        ...(props.defaultValue !== undefined ? { defaultValue: props.defaultValue } : {}),
        onValueChange: (v: string | null, d: { reason: MenubarValueReason; event: unknown }) => {
          emit("valueChange", v, d)
          emit("update:modelValue", v)
        },
      }),
      env,
    )
    const open = () => view.value.values.value ?? null
    const root = shallowRef<Element | null>(null)
    const focusWithin = shallowRef(false)
    const api = computed(() =>
      menubarConnect(
        {
          instance: instance(),
          collection: registered.value ?? EMPTY,
          highlightedKey: view.value.context.highlightedKey,
          focusWithin: focusWithin.value,
          pending: registered.value === null,
          value: open(),
          orientation: props.orientation,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          modal: props.modal,
        },
        send,
        env,
      ),
    )
    expose({ focus: () => send({ type: "FOCUS_MENUBAR" }) } satisfies MenubarActions)
    // An initial value (controlled or default) opens its menu once the menus are mounted (their
    // handles register in the children's mount hooks, which run first).
    const initial = open()
    onMounted(() => {
      if (initial !== null) send({ type: "VALUE.SYNC" })
      // Development: a menubar needs a name.
      const node = root.value
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] menubar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    })
    // Render order (the server tab stop): reset on every render of the root.
    let first: CollectionKey | null = null
    provide(BarKey, {
      instance,
      api: () => api.value,
      send,
      registry,
      handles,
      closing,
      root,
      orientation: () => props.orientation,
      modal: () => props.modal,
      disabled: () => props.disabled,
      claimFirst: (key) => {
        first ??= key
        return first === key
      },
    })
    return () => {
      first = null
      const merged = mergeProps(
        {
          ...normalizeProps(api.value.root()),
          onFocusin: () => (focusWithin.value = true),
          onFocusout: (e: FocusEvent) => {
            const el = e.currentTarget as Element
            if (!el.contains(e.relatedTarget as Node | null)) focusWithin.value = false
          },
          ref: refTo(root),
        },
        attrs,
      )
      return renderPart(
        "div",
        merged,
        slots.default?.({ open: open() !== null, orientation: props.orientation }),
        props.asChild,
      )
    }
  },
})

interface MenuEntry {
  readonly key: () => CollectionKey
  readonly disabled: () => boolean
}
const EntryKey: InjectionKey<MenuEntry> = Symbol("rind-ui.menubar-menu")

/** Registers the menu level's service with the bar (the port's handle). */
const Handle = defineComponent({
  name: "MenubarHandle",
  setup() {
    const bar = useBar("Menu")
    const entry = inject(EntryKey, null)
    const level = inject(MenuLevelKey, null)
    if (!entry || !level) return () => null
    const service = level.service
    const handle: MenuHandle = {
      isOpen: () => service.getSnapshot().state === "open",
      // Sound: every event the port sends is a menu event.
      send: (event: unknown) => service.send(event as Parameters<typeof service.send>[0]),
    }
    onMounted(() => bar.handles.set(entry.key(), handle))
    onBeforeUnmount(() => {
      if (bar.handles.get(entry.key()) === handle) bar.handles.delete(entry.key())
    })
    return () => null
  },
})

const MenubarMenu = defineComponent({
  name: "MenubarMenu",
  props: {
    ...levelOptionProps,
    /** The menu's key in the bar's `value`. */
    value: { type: String, required: true },
    /** Disables this menu: its trigger never opens it. */
    disabled: Boolean,
    /** Positioner and content stay mounted (hidden) while closed. */
    keepMounted: Boolean,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { slots }) {
    const bar = useBar("Menu")
    const key = () => toKey(props.value)
    provide(EntryKey, { key, disabled: () => props.disabled })
    const host: MenuHost = {
      parentKind: "menubar",
      key,
      host: {
        elements: () => (bar.root.value instanceof HTMLElement ? [bar.root.value] : []),
        navigate: ({ direction }) => {
          if (bar.orientation() === "vertical") {
            if (direction === "collapse") {
              bar.send({ type: "MENU_NAVIGATE", from: key(), direction })
            }
            return
          }
          const next = direction === "expand" ? "next" : "previous"
          bar.send({ type: "MENU_NAVIGATE", from: key(), direction: next })
        },
        press: (k, modality) => bar.send({ type: "TRIGGER_PRESS", key: k, modality }),
      },
    }
    provide(MenuHostKey, host)
    return () => {
      const { value: _value, disabled: _disabled, positioning, ...rest } = props
      const vertical = bar.orientation() === "vertical"
      // Menu.Root's own props (the level options, the bar's id, modal and positioning).
      return h(
        Menu.Root as never,
        {
          ...rest,
          id: levelOf(bar.instance(), key()),
          modal: bar.modal(),
          positioning: vertical ? { ...positioningPresets.submenu, ...positioning } : positioning,
          onOpenChange: (open: boolean, details: MenuChangeDetails) => {
            // The bar's own closes (switching, its item pressed) are already in its value.
            if (open) return
            if (bar.closing.delete(key())) return
            bar.send({
              type: "MENU_CLOSED",
              key: key(),
              reason: details.reason as MenuCloseReason,
            })
          },
        },
        () => [h(Handle), slots.default?.()],
      )
    }
  },
})

const Trigger = defineComponent({
  name: "MenubarTrigger",
  inheritAttrs: false,
  props: {
    /** The typeahead text of the bar item. Default: the text content. */
    textValue: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: { readonly open: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const bar = useBar("Trigger")
    const entry = inject(EntryKey, null)
    if (!entry) throw new Error("Menubar.Trigger must be inside Menubar.Menu")
    const disabled = () => bar.disabled() || entry.disabled()
    const el = shallowRef<Element | null>(null)
    useRegisterItem(
      bar.registry,
      () => ({ key: entry.key(), textValue: props.textValue, disabled: disabled() }),
      el,
    )
    return () => {
      const first = bar.claimFirst(entry.key())
      const own = normalizeProps(bar.api().item({ key: entry.key(), disabled: disabled(), first }))
      return h(
        Menu.Trigger,
        {
          ...mergeProps({ ...own, ref: refTo(el) }, attrs),
          disabled: disabled(),
          asChild: props.asChild,
        },
        slots,
      )
    }
  },
})

/** The parts, by name: `menubar.parts.ts` re-exports them as the `Menubar` namespace. */
export { MenubarMenu as Menu, Root, Trigger }
