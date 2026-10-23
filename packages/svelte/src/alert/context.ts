import type { AlertEvent, alertConnect } from "@rind-ui/core"
import { createContext } from "../context"

export const alertContext = createContext<{
  readonly connect: () => ReturnType<typeof alertConnect>
  readonly open: () => boolean
  readonly root: () => Element | null
  readonly send: (event: AlertEvent) => void
}>("alert")
