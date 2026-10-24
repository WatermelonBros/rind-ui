import type { TableOfContentsItem, tableOfContentsConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { TableOfContentsRenderState } from "./types"

export type Marker = { readonly top: number; readonly height: number } | null
export const tocContext = createContext<{
  readonly api: () => ReturnType<typeof tableOfContentsConnect>
  readonly state: () => TableOfContentsRenderState
  readonly navigate: (id: string) => void
  readonly setTitled: (on: boolean) => void
  readonly setMarker: (marker: Marker) => void
}>("table-of-contents")
export const tocItem = createContext<() => TableOfContentsItem>("table-of-contents-item")
