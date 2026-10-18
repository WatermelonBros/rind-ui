// The level tree (design §2): a Sub level registers with its parent. It carries only what
// crosses levels: a link activation anywhere closes every level, and a Sub inherits the
// root's `openOnHover`. Closing a parent closes its children through the layer stack
// (parent-dismissed → PARENT.CLOSE); Escape and hover zones need no tree.

export interface NavigationMenuLevel {
  readonly parent: NavigationMenuLevel | null
  /** Hover opening, decided by the root level. */
  readonly openOnHover: () => boolean
  /** Registers a child level; returns the unregister. */
  add(child: NavigationMenuLevel): () => void
  /** Closes this level (a link activation in the tree). */
  closeSelf(): void
  /** Closes every level of the tree, deepest first, with reason `link-activate`. */
  closeTree(): void
}

export function navigationMenuLevel(
  parent: NavigationMenuLevel | null,
  options: {
    readonly close: () => void
    readonly openOnHover: () => boolean
  },
): NavigationMenuLevel {
  const children = new Set<NavigationMenuLevel>()
  const level: NavigationMenuLevel = {
    parent,
    openOnHover: () => (parent ? parent.openOnHover() : options.openOnHover()),
    add(child) {
      children.add(child)
      return () => children.delete(child)
    },
    closeSelf() {
      for (const c of [...children]) c.closeSelf()
      options.close()
    },
    closeTree() {
      let top: NavigationMenuLevel = level
      while (top.parent) top = top.parent
      top.closeSelf()
    },
  }
  return level
}
