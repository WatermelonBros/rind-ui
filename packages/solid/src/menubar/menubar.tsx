/** @jsxImportSource solid-js */
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
  type MenuCloseReason,
  menubarConnect,
  menubarMachine,
  menuIds,
  positioningPresets,
  toKey,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { type MenuHost, MenuHostContext, MenuLevelContext, type MenuRootProps } from "../menu/menu"
import * as Menu from "../menu/menu.parts"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

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
  readonly instance: Accessor<string>
  readonly api: Accessor<ReturnType<typeof menubarConnect>>
  readonly send: ReturnType<typeof useMachine<typeof menubarMachine>>["send"]
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly handles: Map<CollectionKey, MenuHandle>
  /** Closes the bar itself causes: not reported back as MENU_CLOSED. */
  readonly closing: Set<CollectionKey>
  readonly root: Accessor<HTMLElement | null>
  readonly orientation: Accessor<"horizontal" | "vertical">
  readonly modal: Accessor<boolean>
  readonly disabled: Accessor<boolean>
  readonly claimFirst: (key: CollectionKey) => boolean
}

const BarContext = createContext<Bar>()
function useBar(part: string): Bar {
  const bar = useContext(BarContext)
  if (!bar) throw new Error(`Menubar.${part} must be inside Menubar.Root`)
  return bar
}

/** The menu's level id: its trigger's element id is the bar item's (ids.item). */
const levelOf = (instance: string, key: string) => `${instance}-menu-${key}`

/** What `actionsRef` exposes. */
export interface MenubarActions {
  /** Focuses the bar's tab stop (for an application shortcut such as F10). */
  focus(): void
}

export interface MenubarState {
  readonly open: boolean
  readonly orientation: "horizontal" | "vertical"
}

export type MenubarRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
  readonly id?: string | undefined
  /** The bar's `Menubar.Menu` entries. */
  readonly children?: JSX.Element | ((state: MenubarState) => JSX.Element)
  /** The open menu's value, or null. */
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((
        value: string | null,
        details: { readonly reason: MenubarValueReason; readonly event: unknown },
      ) => void)
    | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  /** Default true: passed to every menu. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled items stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: MenubarActions) => void) | undefined
  readonly render?: RenderProp<MenubarState> | undefined
}

function Root(props: MenubarRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "orientation",
    "loop",
    "modal",
    "disabled",
    "focusableWhenDisabled",
    "actionsRef",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => rest.id)
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const handles = new Map<CollectionKey, MenuHandle>()
  const closing = new Set<CollectionKey>()
  const orientation = () => own.orientation ?? "horizontal"
  const modal = () => own.modal ?? true
  const disabled = () => own.disabled === true
  const focusableWhenDisabled = () => own.focusableWhenDisabled ?? true
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
      // Cleared by the menu's onOpenChange, which may run after this returns; at once when
      // the menu did not close (nothing will be reported), and by the next open otherwise.
      closing.add(key)
      h.send(switching ? { type: "TREE.SIBLING_OPENED" } : { type: "CLOSE" })
      if (h.isOpen()) closing.delete(key)
    },
  }
  const ids = createMemo(() => ({
    list: `${instance()}-menubar`,
    item: (key: CollectionKey) => menuIds(levelOf(instance(), key)).trigger,
  }))
  const { view, send } = useMachine(
    menubarMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: own.loop ?? true,
      // Disabled items stay reachable by the bar's arrows and typeahead unless `false`;
      // keyboard switching between open menus skips them either way.
      focusableWhenDisabled: focusableWhenDisabled(),
      orientation: orientation(),
      modal: modal(),
      disabled: disabled(),
      menus,
      ...(own.value !== undefined ? { value: own.value } : {}),
      ...(own.defaultValue !== undefined ? { defaultValue: own.defaultValue } : {}),
      ...(own.onValueChange ? { onValueChange: own.onValueChange } : {}),
    }),
    env,
  )
  const open = () => view().values.value ?? null
  const [root, setRoot] = createSignal<HTMLElement | null>(null)
  const [focusWithin, setFocusWithin] = createSignal(false)
  const api = createMemo(() =>
    menubarConnect(
      {
        instance: instance(),
        collection: collection(),
        highlightedKey: view().context.highlightedKey,
        focusWithin: focusWithin(),
        pending: registered() === null,
        value: open(),
        orientation: orientation(),
        disabled: disabled(),
        focusableWhenDisabled: focusableWhenDisabled(),
        modal: modal(),
      },
      send,
      env,
    ),
  )
  own.actionsRef?.({ focus: () => send({ type: "FOCUS_MENUBAR" }) })
  // An initial value (controlled or default) opens its menu once the menus are mounted (their
  // handles register in the children's effects, which run first).
  const initial = untrack(open)
  afterMount(() =>
    afterMount(() => {
      if (initial !== null) send({ type: "VALUE.SYNC" })
    }),
  )
  // Development: a menubar needs a name.
  afterMount(() => {
    const node = root()
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] menubar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
      )
    }
  })
  // Render order (the server tab stop).
  let first: CollectionKey | null = null
  const bar: Bar = {
    instance,
    api,
    send,
    registry,
    handles,
    closing,
    root,
    orientation,
    modal,
    disabled,
    claimFirst: (key) => {
      first ??= key
      return first === key
    },
  }
  const state = reactive<MenubarState>(() => ({
    open: open() !== null,
    orientation: orientation(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        onFocusIn: () => setFocusWithin(true),
        onFocusOut: (e: FocusEvent) => {
          if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null))
            setFocusWithin(false)
        },
        ref: setRoot,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <BarContext.Provider value={bar}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </BarContext.Provider>
  )
}

export type MenubarMenuProps = Omit<
  MenuRootProps,
  "open" | "defaultOpen" | "onOpenChange" | "modal" | "id"
> & {
  /** The menu's key in the bar's `value`. */
  readonly value: string
  /** Disables this menu: its trigger never opens it. */
  readonly disabled?: boolean | undefined
}

interface MenuEntry {
  readonly key: Accessor<CollectionKey>
  readonly disabled: Accessor<boolean>
}
const MenuEntryContext = createContext<MenuEntry>()

/** Registers the menu level's service with the bar (the port's handle). */
function Handle(props: { readonly bar: Bar; readonly entry: MenuEntry }) {
  const level = useContext(MenuLevelContext)
  createEffect(() => {
    if (!level) return
    const service = level.service
    const key = props.entry.key()
    const handle: MenuHandle = {
      isOpen: () => service.getSnapshot().state === "open",
      // Sound: every event the port sends is a menu event.
      send: (event: unknown) => service.send(event as Parameters<typeof service.send>[0]),
    }
    props.bar.handles.set(key, handle)
    onCleanup(() => {
      if (props.bar.handles.get(key) === handle) props.bar.handles.delete(key)
    })
  })
  return null
}

function MenubarMenu(props: MenubarMenuProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "positioning", "children"])
  const bar = useBar("Menu")
  const key = createMemo(() => toKey(local.value))
  const entry: MenuEntry = { key, disabled: () => local.disabled === true }
  const host: MenuHost = {
    parentKind: "menubar",
    get key() {
      return key()
    },
    host: {
      elements: () => {
        const r = bar.root()
        return r ? [r] : []
      },
      navigate: ({ direction }) => {
        if (bar.orientation() === "vertical") {
          if (direction === "collapse") bar.send({ type: "MENU_NAVIGATE", from: key(), direction })
          return
        }
        const next = direction === "expand" ? "next" : "previous"
        bar.send({ type: "MENU_NAVIGATE", from: key(), direction: next })
      },
      press: (k, modality) => bar.send({ type: "TRIGGER_PRESS", key: k, modality }),
    },
  }
  const vertical = () => bar.orientation() === "vertical"
  return (
    <MenuHostContext.Provider value={host}>
      <MenuEntryContext.Provider value={entry}>
        <Menu.Root
          {...rest}
          id={levelOf(untrack(bar.instance), untrack(key))}
          modal={bar.modal()}
          positioning={
            vertical() ? { ...positioningPresets.submenu, ...local.positioning } : local.positioning
          }
          onOpenChange={(open, details) => {
            // The bar's own closes (switching, its item pressed) are already in its value.
            if (open) return
            if (bar.closing.delete(key())) return
            bar.send({ type: "MENU_CLOSED", key: key(), reason: details.reason as MenuCloseReason })
          }}
        >
          <Handle bar={bar} entry={entry} />
          {local.children}
        </Menu.Root>
      </MenuEntryContext.Provider>
    </MenuHostContext.Provider>
  )
}

export type MenubarTriggerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The typeahead text of the bar item. Default: the text content. */
  readonly textValue?: string | undefined
  readonly render?: RenderProp<{ readonly open: boolean }> | undefined
  readonly children?: JSX.Element
}

function Trigger(props: MenubarTriggerProps) {
  const [local, rest] = splitProps(props, ["textValue", "children"])
  const bar = useBar("Trigger")
  const entry = useContext(MenuEntryContext)
  if (!entry) throw new Error("Menubar.Trigger must be inside Menubar.Menu")
  const disabled = () => bar.disabled() || entry.disabled()
  const [el, setEl] = createSignal<Element | null>(null)
  useRegisterItem(
    bar.registry,
    () => ({ key: entry.key(), textValue: local.textValue, disabled: disabled() }),
    el,
  )
  const first = bar.claimFirst(untrack(entry.key))
  const merged = createMemo(
    () =>
      mergeProps(
        {
          ...normalizeProps(bar.api().item({ key: entry.key(), disabled: disabled(), first })),
          ref: setEl,
        },
        rest,
      ) as Record<string, unknown>,
  )
  // The children stay the last source: reading them never tracks the bar's state.
  return (
    // Sound: Menu.Trigger renders a div in menubar mode; its props are the div's.
    <Menu.Trigger {...(merged() as Record<string, unknown>)} disabled={disabled()}>
      {local.children}
    </Menu.Trigger>
  )
}

/** The parts, by name: `menubar.parts.ts` re-exports them as the `Menubar` namespace. */
export { MenubarMenu as Menu, Root, Trigger }
