import type { toggleConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ToggleState } from "./types"

export const toggleContext = createContext<{
  readonly api: () => ReturnType<typeof toggleConnect>
  readonly state: () => ToggleState
}>("toggle")
