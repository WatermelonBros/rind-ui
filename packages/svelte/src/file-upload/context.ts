import type { DropSource, FileLike, FileUploadEvent, fileUploadConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { FileUploadRenderState } from "./types"

export const fileUploadContext = createContext<{
  readonly api: () => ReturnType<typeof fileUploadConnect>
  readonly send: (event: FileUploadEvent) => void
  readonly state: () => FileUploadRenderState<FileLike>
  readonly ids: () => { readonly label: string; readonly trigger: string }
  readonly registry: PartRegistry<"label">
  readonly dropSource: () => DropSource<FileLike>
  /** A removal asks for focus to move after the update (to the index's Remove, else the Trigger). */
  readonly focusAfterRemoval: { current: number | null }
  readonly hasTrigger: { current: boolean }
}>("file-upload")
export const fileUploadItem = createContext<{
  readonly file: () => FileLike
  readonly index: () => number
}>("file-upload-item")

// ── Missed drops (design §6): one document listener, reference counted ──
let documentDropUsers = 0
const preventMissedDrop = (e: DragEvent) => {
  if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return
  const target = e.target as Element | null
  if (target?.closest?.('[data-scope="file-upload"][data-part="dropzone"]')) return
  // A file dropped outside a Dropzone would navigate the tab to it.
  e.preventDefault()
  if (e.dataTransfer && e.type === "dragover") e.dataTransfer.dropEffect = "none"
}
export function preventDocumentDrops() {
  if (documentDropUsers++ === 0) {
    document.addEventListener("dragover", preventMissedDrop)
    document.addEventListener("drop", preventMissedDrop)
  }
  return () => {
    if (--documentDropUsers === 0) {
      document.removeEventListener("dragover", preventMissedDrop)
      document.removeEventListener("drop", preventMissedDrop)
    }
  }
}
