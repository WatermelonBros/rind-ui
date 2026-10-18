// Menubar parts (design §7): Root (the bar's service, its item registry and the port to
// its menus), Menu (an ordinary Menu root level hosted by the bar) and Trigger (the menu's
// trigger in menubar mode, plus the bar's roving wiring). Inside a menu, the Menu parts.

import {
  type CollectionKey,
  createListCollection,
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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Menu,
  type MenuHost,
  MenuHostContext,
  MenuLevelContext,
  type MenuRootProps,
} from "../menu/menu"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
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
  readonly instance: string
  readonly api: ReturnType<typeof menubarConnect>
  readonly send: ReturnType<typeof useMachine<typeof menubarMachine>>["send"]
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly handles: Map<CollectionKey, MenuHandle>
  /** Closes the bar itself causes: not reported back as MENU_CLOSED. */
  readonly closing: Set<CollectionKey>
  readonly root: { current: HTMLElement | null }
  readonly orientation: "horizontal" | "vertical"
  readonly modal: boolean
  readonly disabled: boolean
  readonly claimFirst: (key: CollectionKey) => boolean
}

const BarContext = createContext<Bar | null>(null)
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

export type MenubarRootProps = Omit<ComponentPropsWithRef<"div">, "children" | "defaultValue"> & {
  /** The bar's `Menubar.Menu` entries. */
  readonly children?: ReactNode
  /** The open menu's value, or null. */
  readonly value?: string | null
  readonly defaultValue?: string | null
  readonly onValueChange?: (
    value: string | null,
    details: { readonly reason: MenubarValueReason; readonly event: unknown },
  ) => void
  readonly orientation?: "horizontal" | "vertical"
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean
  /** Default true: passed to every menu. */
  readonly modal?: boolean
  readonly disabled?: boolean
  /** Disabled items stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean
  readonly actionsRef?: Ref<MenubarActions>
  readonly render?: RenderProp<MenubarState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  loop = true,
  modal = true,
  disabled = false,
  focusableWhenDisabled = true,
  actionsRef,
  render,
  id,
  ref,
  children,
  ...rest
}: MenubarRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const [handles] = useState(() => new Map<CollectionKey, MenuHandle>())
  const [closing] = useState(() => new Set<CollectionKey>())
  // The port to the menus: idempotent (a parent's value may repeat what already happened).
  const [menus] = useState<MenubarMenus>(() => ({
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
  }))
  const ids = useMemo(
    () => ({
      list: `${instance}-menubar`,
      item: (key: CollectionKey) => menuIds(levelOf(instance, key)).trigger,
    }),
    [instance],
  )
  const { view, send } = useMachine(menubarMachine, {
    collection,
    strategy: "roving",
    ids,
    loop,
    // Disabled items stay reachable by the bar's arrows and typeahead unless `false`;
    // keyboard switching between open menus skips them either way.
    focusableWhenDisabled,
    orientation,
    modal,
    disabled,
    menus,
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(onValueChange ? { onValueChange } : {}),
  })
  const open = view.values.value ?? null
  const root = useRef<HTMLElement | null>(null)
  const [focusWithin, setFocusWithin] = useState(false)
  const api = menubarConnect(
    {
      instance,
      collection,
      highlightedKey: view.context.highlightedKey,
      focusWithin,
      pending: registered === null,
      value: open,
      orientation,
      disabled,
      focusableWhenDisabled,
      modal,
    },
    send,
    env,
  )
  useImperativeHandle(actionsRef, () => ({ focus: () => send({ type: "FOCUS_MENUBAR" }) }), [send])
  // An initial value (controlled or default) opens its menu once the menus are mounted (their
  // handles register in the children's effects, which run first).
  const initial = useRef(open)
  useEffect(() => {
    if (initial.current !== null) send({ type: "VALUE.SYNC" })
  }, [send])
  // Development: a menubar needs a name.
  useEffect(() => {
    const node = root.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] menubar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
      )
    }
  })
  // Render order (the server tab stop): reset on every render of the root.
  const first = useRef<CollectionKey | null>(null)
  first.current = null
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
      first.current ??= key
      return first.current === key
    },
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      onFocus: () => setFocusWithin(true),
      onBlur: (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
      },
      ref: composeRefs(root, ref),
    },
    rest,
  )
  return (
    <BarContext value={bar}>
      {renderPart("div", { ...props, children }, render, { open: open !== null, orientation })}
    </BarContext>
  )
}

export type MenubarMenuProps = Omit<
  MenuRootProps,
  "open" | "defaultOpen" | "onOpenChange" | "modal" | "id"
> & {
  /** The menu's key in the bar's `value`. */
  readonly value: string
  /** Disables this menu: its trigger never opens it. */
  readonly disabled?: boolean
}

interface MenuEntry {
  readonly key: CollectionKey
  readonly disabled: boolean
}
const MenuEntryContext = createContext<MenuEntry | null>(null)

/** Registers the menu level's service with the bar (the port's handle). */
function Handle({ bar, entry }: { readonly bar: Bar; readonly entry: MenuEntry }) {
  const level = useContext(MenuLevelContext)
  useEffect(() => {
    if (!level) return
    const service = level.service
    const handle: MenuHandle = {
      isOpen: () => service.getSnapshot().state === "open",
      // Sound: every event the port sends is a menu event.
      send: (event: unknown) => service.send(event as Parameters<typeof service.send>[0]),
    }
    bar.handles.set(entry.key, handle)
    return () => {
      if (bar.handles.get(entry.key) === handle) bar.handles.delete(entry.key)
    }
  }, [bar.handles, entry.key, level])
  return null
}

function MenubarMenu({
  value,
  disabled = false,
  positioning,
  children,
  ...rest
}: MenubarMenuProps) {
  const bar = useBar("Menu")
  const key = toKey(value)
  const { send, orientation, root, closing } = bar
  const entry = useMemo(() => ({ key, disabled }), [key, disabled])
  const host = useMemo<MenuHost>(
    () => ({
      parentKind: "menubar",
      key,
      host: {
        elements: () => (root.current ? [root.current] : []),
        navigate: ({ direction }) => {
          if (orientation === "vertical") {
            if (direction === "collapse") send({ type: "MENU_NAVIGATE", from: key, direction })
            return
          }
          const next = direction === "expand" ? "next" : "previous"
          send({ type: "MENU_NAVIGATE", from: key, direction: next })
        },
        press: (k, modality) => send({ type: "TRIGGER_PRESS", key: k, modality }),
      },
    }),
    [key, orientation, root, send],
  )
  const vertical = orientation === "vertical"
  return (
    <MenuHostContext value={host}>
      <MenuEntryContext value={entry}>
        <Menu.Root
          {...rest}
          id={levelOf(bar.instance, key)}
          modal={bar.modal}
          positioning={vertical ? { ...positioningPresets.submenu, ...positioning } : positioning}
          onOpenChange={(open, details) => {
            // The bar's own closes (switching, its item pressed) are already in its value.
            if (open) return
            if (closing.delete(key)) return
            send({ type: "MENU_CLOSED", key, reason: details.reason as MenuCloseReason })
          }}
        >
          <Handle bar={bar} entry={entry} />
          {children}
        </Menu.Root>
      </MenuEntryContext>
    </MenuHostContext>
  )
}

export type MenubarTriggerProps = ComponentPropsWithRef<"div"> & {
  /** The typeahead text of the bar item. Default: the text content. */
  readonly textValue?: string
  readonly render?: RenderProp<{ readonly open: boolean }>
}

function Trigger({ textValue, ref, ...rest }: MenubarTriggerProps) {
  const bar = useBar("Trigger")
  const entry = useContext(MenuEntryContext)
  if (!entry) throw new Error("Menubar.Trigger must be inside Menubar.Menu")
  const disabled = bar.disabled || entry.disabled
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(bar.registry, { key: entry.key, textValue, disabled }, el)
  const first = bar.claimFirst(entry.key)
  const own = normalizeProps(bar.api.item({ key: entry.key, disabled, first }))
  // Sound: Menu.Trigger renders a div in menubar mode; its props are the div's.
  const props = mergeProps({ ...own, ref: composeRefs(el, ref) }, rest) as Parameters<
    typeof Menu.Trigger
  >[0]
  return <Menu.Trigger {...props} disabled={disabled} />
}

export const Menubar = { Root, Menu: MenubarMenu, Trigger }
