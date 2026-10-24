import type { ImageCropperEvent, imageCropperConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ImageCropperRenderState } from "./types"

export const imageCropper = createContext<{
  readonly api: () => ReturnType<typeof imageCropperConnect>
  readonly state: () => ImageCropperRenderState
  readonly send: (event: ImageCropperEvent) => void
  readonly steps: () => { readonly base: number; readonly shift: number; readonly ctrl: number }
}>("image-cropper")
