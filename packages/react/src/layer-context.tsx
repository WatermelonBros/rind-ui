import type { LayerId, LayerKind } from "@rind-ui/core"
import { createContext, type ReactNode, useContext } from "react"

interface LayerLink {
  readonly id: LayerId
  /** Undefined for a layer that did not declare one (any kind matches it). */
  readonly kind: LayerKind | undefined
  readonly up: LayerLink | undefined
}

const LayerContext = createContext<LayerLink | undefined>(undefined)

/** Declares the parent layer for every layer rendered below (explicit parentage). */
export function LayerProvider({
  layer,
  kind,
  children,
}: {
  layer: LayerId
  kind?: LayerKind
  children?: ReactNode
}) {
  const up = useContext(LayerContext)
  return <LayerContext value={{ id: layer, kind, up }}>{children}</LayerContext>
}

/**
 * The layer this component is rendered in, if any: its parent when it opens a layer. With
 * `kinds`, the nearest enclosing layer of one of those kinds (a dialog rendered inside a menu
 * is not the menu's child: radix#1836).
 */
export function useParentLayer(kinds?: readonly LayerKind[]): LayerId | undefined {
  let link = useContext(LayerContext)
  while (link && kinds && link.kind !== undefined && !kinds.includes(link.kind)) link = link.up
  return link?.id
}
