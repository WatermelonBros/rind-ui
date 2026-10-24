import type {
  CollectionKey,
  ItemRegistry,
  MenubarOpening,
  menubarConnect,
  menubarMachine,
  Service,
} from "@rind-ui/core"
import { createContext } from "../context"

/** One menu level, as the bar drives it. */
export interface MenuHandle {
  isOpen(): boolean
  send(event: { type: "TRIGGER_PRESS"; modality: MenubarOpening["modality"] }): void
  send(event: { type: "TRIGGER_KEY"; key: "first" | "last" }): void
  send(event: { type: "CLOSE" } | { type: "TREE.SIBLING_OPENED" }): void
}

export interface Bar {
  readonly instance: () => string
  readonly api: () => ReturnType<typeof menubarConnect>
  readonly send: Service<typeof menubarMachine>["send"]
  readonly registry: ItemRegistry
  readonly handles: Map<CollectionKey, MenuHandle>
  /** Closes the bar itself causes: not reported back as MENU_CLOSED. */
  readonly closing: Set<CollectionKey>
  readonly root: () => Element | null
  readonly orientation: () => "horizontal" | "vertical"
  readonly modal: () => boolean
  readonly disabled: () => boolean
  readonly claimFirst: (key: CollectionKey) => boolean
}
export const menubar = createContext<Bar>("menubar")

export interface MenuEntry {
  readonly key: () => CollectionKey
  readonly disabled: () => boolean
}
export const menubarEntry = createContext<MenuEntry>("menubar-menu")

/** The menu's level id: its trigger's element id is the bar item's (ids.item). */
export const levelOf = (instance: string, key: string) => `${instance}-menu-${key}`
