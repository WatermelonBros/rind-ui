// Search Field parts on top of Text Field's (design §2): search semantics on the input, the
// empty flag, and the keys mapped to machine events after the consumer's own handler.

import { dataFlag, type PartProps } from "../../connect/props"
import type { SearchFieldEvent } from "./search-field.machine"

export interface SearchFieldConnectInput {
  readonly value: string
  readonly composing: boolean
  /** A ClearTrigger is mounted: the browser's own cancel button is hidden. */
  readonly customClear: boolean
}

/** The injected rule: one clear control while a ClearTrigger is mounted. */
export const searchCancelStyle =
  '[data-scope="search-field"][data-part="input"][data-custom-clear]::-webkit-search-cancel-button { appearance: none; display: none }'

type KeyLike = {
  readonly key: string
  readonly keyCode?: number
  readonly isComposing?: boolean
  readonly nativeEvent?: { readonly isComposing?: boolean }
  preventDefault(): void
  stopPropagation(): void
}

export function searchFieldConnect(
  input: SearchFieldConnectInput,
  send: (event: SearchFieldEvent) => void,
) {
  const empty = dataFlag(input.value === "")
  return {
    root: () => ({ "data-empty": empty }),
    /** Joined to Text Field's input props; `type` and `enterKeyHint` are defaults. */
    input: (): PartProps => ({
      type: "search",
      enterkeyhint: "search",
      "data-empty": empty,
      "data-custom-clear": dataFlag(input.customClear),
      onKeyDown: (e: unknown) => {
        const k = e as KeyLike
        if (k.key !== "Escape" && k.key !== "Enter") return
        const composing =
          input.composing ||
          k.isComposing === true ||
          k.nativeEvent?.isComposing === true ||
          k.keyCode === 229
        send({ type: k.key === "Escape" ? "ESCAPE" : "SUBMIT", event: k, composing })
      },
    }),
  }
}
