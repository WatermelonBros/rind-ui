import type { SplitterEvent, SplitterOrientation, splitterConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { SplitterState } from "./types"

export const splitterContext = createContext<{
  readonly api: () => ReturnType<typeof splitterConnect>
  readonly state: () => SplitterState
  readonly send: (e: SplitterEvent) => void
  readonly handles: (Element | null)[]
  readonly press: (e: PointerEvent) => boolean
  readonly setHandleDisabled: (index: number, disabled: boolean | undefined) => void
  readonly orientation: () => SplitterOrientation
  readonly dir: () => "ltr" | "rtl"
}>("splitter")
