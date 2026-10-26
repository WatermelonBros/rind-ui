import type { SignaturePadEvent, signaturePadConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { SignaturePadRenderState } from "./types"

export const signaturePadContext = createContext<{
  readonly api: () => ReturnType<typeof signaturePadConnect>
  readonly send: (event: SignaturePadEvent) => void
  readonly state: () => SignaturePadRenderState
  readonly registry: PartRegistry<"label" | "status">
  readonly ids: () => { readonly label: string; readonly status: string }
  readonly control: { current: HTMLElement | null }
}>("signature-pad")
