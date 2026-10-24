import type { ImageViewerEvent, imageViewerConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ImageViewerRenderState } from "./types"

export const imageViewer = createContext<{
  readonly api: () => ReturnType<typeof imageViewerConnect>
  readonly state: () => ImageViewerRenderState
  readonly send: (event: ImageViewerEvent) => void
  readonly setLabel: (label: string) => void
  /** Pan room on each axis (px), for the arrow keys. */
  readonly room: () => { readonly width: number; readonly height: number }
  readonly viewport: () => { readonly width: number; readonly height: number }
  readonly wheelZooms: () => boolean
}>("image-viewer")
