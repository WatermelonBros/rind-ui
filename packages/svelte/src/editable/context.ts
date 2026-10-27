import type { ActivationMode, EditableEvent, editableConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { EditableRenderState } from "./types"

export const editableContext = createContext<{
  readonly api: () => ReturnType<typeof editableConnect>
  readonly send: (event: EditableEvent) => void
  readonly state: () => EditableRenderState
  readonly activationMode: () => ActivationMode
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly inputEl: { current: HTMLElement | null }
  readonly previewEl: { current: HTMLElement | null }
}>("editable")
