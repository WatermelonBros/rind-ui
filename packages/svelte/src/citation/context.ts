import type { CitationSource, citationConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { CitationRenderState } from "./types"

export const citationContext = createContext<{
  readonly api: () => ReturnType<typeof citationConnect>
  readonly state: () => CitationRenderState
  readonly source: () => CitationSource | undefined
  readonly press: () => void
}>("citation")
