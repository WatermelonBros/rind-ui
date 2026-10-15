import type { LayerId } from "@rind-ui/core"
import { createContext, type ReactNode, useContext } from "react"

const LayerContext = createContext<LayerId | undefined>(undefined)

/** Declares the parent layer for every layer rendered below (explicit parentage). */
export function LayerProvider({ layer, children }: { layer: LayerId; children?: ReactNode }) {
  return <LayerContext value={layer}>{children}</LayerContext>
}

/** The layer this component is rendered in, if any: its parent when it opens a layer. */
export function useParentLayer(): LayerId | undefined {
  return useContext(LayerContext)
}
