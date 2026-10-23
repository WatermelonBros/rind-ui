import type { QrDownloadOptions, qrCodeConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { QrCodeState } from "./types"

type Modality = "pointer" | "keyboard" | "touch" | "virtual"
export const qrCodeContext = createContext<{
  readonly connect: () => ReturnType<typeof qrCodeConnect>
  readonly registry: PartRegistry<"value-text">
  readonly value: () => string
  readonly state: () => QrCodeState
  readonly download: (options: QrDownloadOptions & { readonly modality: Modality }) => void
  readonly report: (part: "valueText" | "overlay", mounted: boolean) => void
}>("qr-code")
