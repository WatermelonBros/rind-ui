// The menu tree (design §1): one service per level, linked by this plain object. It owns
// the open path — at most one open child per level, so a sibling sweep can never leave two
// submenus open (base-ui#5152, radix#3761) — and closes the whole tree from any level.
// Machines call it only from actions; the root adapter creates it and injects it.

import type { CollectionKey } from "../../collection/key"
import type { Modality } from "../../contract/env"

export type MenuLevelId = string & { readonly __brand: "MenuLevelId" }
export const menuLevelId = (id: string): MenuLevelId => id as MenuLevelId

export type MenuParentKind = "menu" | "menubar" | "context-menu"

/** Why the tree closed (kebab case: `onOpenChange`'s `details.reason`). */
export type MenuCloseReason =
  | "trigger"
  | "item-select"
  | "escape-key"
  | "tab-key"
  | "outside-press"
  | "outside-focus"
  | "window-blur"
  | "parent-dismissed"
  | "api"
  /** A non-modal context menu: the page scrolled. */
  | "scroll"

export type MenuTreeEvent =
  | { readonly type: "TREE.CLOSE"; readonly reason: MenuCloseReason }
  /** A sibling level opened: close without restoring focus (focus moves into the sibling). */
  | { readonly type: "TREE.SIBLING_OPENED" }
  /** A child submenu closed because the pointer left it (its grace area ended). */
  | { readonly type: "TREE.CHILD_LEFT" }

export interface MenuTreeLevel {
  readonly id: MenuLevelId
  readonly parent: MenuLevelId | null
  /** The element that opens the level (the root trigger, a submenu trigger item). */
  readonly trigger: () => HTMLElement | null
  readonly send: (event: MenuTreeEvent) => void
}

/** What a menubar hosting the root level provides (add-menubar). */
export interface MenuTreeHost {
  /** The menubar root: inside the root level's layer. */
  elements(): readonly HTMLElement[]
  /** An expand or collapse key the level did not consume. */
  navigate(input: { readonly from: MenuLevelId; readonly direction: "expand" | "collapse" }): void
  /** The root trigger's press, delegated to the bar (with its modality). */
  press(key: CollectionKey, modality: Modality): void
}

export interface MenuTree {
  register(level: MenuTreeLevel): () => void
  /** `child` opened under `parent`: an open sibling closes first. */
  openChild(parent: MenuLevelId, child: MenuLevelId): void
  /** `byHover`: the pointer left it; its parent then highlights the item under the pointer. */
  childClosed(child: MenuLevelId, options?: { readonly byHover?: boolean }): void
  /** Closes every level: the root receives TREE.CLOSE (its children follow as layers). */
  closeTree(reason: MenuCloseReason): void
  /** The open levels below the root, outermost first. */
  openPath(): readonly MenuLevelId[]
  /**
   * Tab leaves the tree from the root trigger. A context menu has none (null): the overlay
   * returns focus to what was focused at open, and Tab moves on from there.
   */
  rootTrigger(): HTMLElement | null
  parentKind(): MenuParentKind | null
  parentElements(): readonly HTMLElement[]
  parentNavigate(input: {
    readonly from: MenuLevelId
    readonly direction: "expand" | "collapse"
  }): void
  parentPress(key: CollectionKey, modality: Modality): void
}

export function createMenuTree(
  options: { readonly parentKind?: MenuParentKind; readonly host?: MenuTreeHost } = {},
): MenuTree {
  const levels = new Map<MenuLevelId, MenuTreeLevel>()
  /** parent → its open child. */
  const open = new Map<MenuLevelId, MenuLevelId>()
  const root = () => [...levels.values()].find((l) => l.parent === null)
  return {
    register(level) {
      levels.set(level.id, level)
      return () => {
        if (levels.get(level.id) === level) levels.delete(level.id)
        for (const [parent, child] of open) {
          if (child === level.id || parent === level.id) open.delete(parent)
        }
      }
    },
    openChild(parent, child) {
      const previous = open.get(parent)
      open.set(parent, child)
      if (previous !== undefined && previous !== child) {
        levels.get(previous)?.send({ type: "TREE.SIBLING_OPENED" })
      }
    },
    childClosed(child, options) {
      for (const [parent, c] of open) if (c === child) open.delete(parent)
      if (!options?.byHover) return
      const parent = levels.get(child)?.parent
      if (parent) levels.get(parent)?.send({ type: "TREE.CHILD_LEFT" })
    },
    closeTree(reason) {
      root()?.send({ type: "TREE.CLOSE", reason })
    },
    openPath() {
      const path: MenuLevelId[] = []
      let at = root()?.id
      while (at !== undefined) {
        const child = open.get(at)
        if (child === undefined) break
        path.push(child)
        at = child
      }
      return path
    },
    // A region is no trigger: focusing it would put Tab at its first descendant, not past the
    // row the menu opened on (base-ui#6063 class).
    rootTrigger: () => (options.parentKind === "context-menu" ? null : (root()?.trigger() ?? null)),
    parentKind: () => options.parentKind ?? null,
    parentElements: () => options.host?.elements() ?? [],
    parentNavigate: (input) => options.host?.navigate(input),
    parentPress: (key, modality) => options.host?.press(key, modality),
  }
}
