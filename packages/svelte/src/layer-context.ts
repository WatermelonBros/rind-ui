import type { LayerId, LayerKind } from "@rind-ui/core"
import { createContext } from "./context"

interface LayerLink {
  readonly id: LayerId
  /** Undefined for a layer that did not declare one (any kind matches it). */
  readonly kind: LayerKind | undefined
  readonly up: LayerLink | undefined
}

const layer = createContext<LayerLink>("layer")

/**
 * Declares this component's layer as the parent of every layer rendered below. Call during
 * initialisation (contexts reach a portal's content too: it mounts with them).
 */
export function provideLayer(id: () => LayerId, kind?: () => LayerKind | undefined): void {
  const up = layer.maybe()
  layer.set({
    get id() {
      return id()
    },
    get kind() {
      return kind?.()
    },
    up,
  })
}

/**
 * The layer this component is rendered in, if any: its parent when it opens a layer. With
 * `kinds`, the nearest enclosing layer of one of those kinds (a dialog rendered inside a menu
 * is not the menu's child: radix#1836); a layer that declared no kind never matches then.
 * Call during initialisation; call the result when needed.
 */
export function useParentLayer(kinds?: readonly LayerKind[]): () => LayerId | undefined {
  const start = layer.maybe()
  return () => {
    let link = start
    while (link && kinds && (link.kind === undefined || !kinds.includes(link.kind))) link = link.up
    return link?.id
  }
}
