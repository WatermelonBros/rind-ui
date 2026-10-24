import type { imageConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ImageHost } from "../image-status.svelte"
import type { ImageState } from "./types"

export const imageContext = createContext<{
  readonly api: () => ReturnType<typeof imageConnect>
  readonly host: ImageHost
  readonly state: () => ImageState
  readonly fallback: () => boolean
}>("image")
