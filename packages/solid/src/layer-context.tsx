/** @jsxImportSource solid-js */
import type { LayerId, LayerKind } from "@rind-ui/core"
import { createContext, type JSX, useContext } from "solid-js"

interface LayerLink {
  readonly id: () => LayerId
  /** Undefined for a layer that did not declare one (any kind matches it). */
  readonly kind: () => LayerKind | undefined
  readonly up: LayerLink | undefined
}

/** Context crosses portals: a portalled layer's parent is where it was declared. */
const LayerContext = createContext<LayerLink | undefined>(undefined)

/** Declares the parent layer for every layer rendered below (explicit parentage). */
export function LayerProvider(props: {
  readonly layer: LayerId
  readonly kind?: LayerKind | undefined
  readonly children?: JSX.Element
}) {
  const up = useContext(LayerContext)
  const link: LayerLink = { id: () => props.layer, kind: () => props.kind, up }
  return <LayerContext.Provider value={link}>{props.children}</LayerContext.Provider>
}

/**
 * The layer this component is rendered in, if any: its parent when it opens a layer. With
 * `kinds`, the nearest enclosing layer of one of those kinds (a dialog rendered inside a menu
 * is not the menu's child: radix#1836); a layer that declared no kind never matches then.
 */
export function useParentLayer(kinds?: readonly LayerKind[]): () => LayerId | undefined {
  const start = useContext(LayerContext)
  return () => {
    let link = start
    while (
      link &&
      kinds &&
      (link.kind() === undefined || !kinds.includes(link.kind() as LayerKind))
    )
      link = link.up
    return link?.id()
  }
}
