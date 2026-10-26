import type { suggestionsConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { SuggestionsRenderState } from "./types"

export interface SuggestionsEntry {
  readonly el: Element
  readonly key: string
}

export const suggestionsContext = createContext<{
  readonly api: () => ReturnType<typeof suggestionsConnect>
  readonly state: () => SuggestionsRenderState
  readonly register: (id: string, entry: SuggestionsEntry) => () => void
  readonly indexOf: (id: string) => number
  readonly press: (details: {
    key: string
    value: string
    index: number
    itemDisabled: boolean
    focusWasInside: boolean
  }) => void
  readonly contains: (el: Element | null) => boolean
}>("suggestions")
