// Text Field keys and search semantics: Escape and Enter as machine events (for every
// type), `type="search"` attributes, and the one-clear-control rule.

import { dataFlag, type PartProps } from "../../connect/props"
import type { TextFieldOwnEvent } from "./text-field.machine"

export interface TextFieldKeysInput {
  readonly value: string
  readonly composing: boolean
  /** `type="search"`: the search attributes. */
  readonly search: boolean
  /** A ClearTrigger is mounted: the browser's own cancel button is hidden. */
  readonly customClear: boolean
}

/** The injected rule: one clear control while a ClearTrigger is mounted. */
export const textFieldCancelStyle =
  '[data-scope="text-field"][data-part="input"][data-custom-clear]::-webkit-search-cancel-button { appearance: none; display: none }'

type KeyLike = {
  readonly key: string
  readonly keyCode?: number
  readonly isComposing?: boolean
  readonly nativeEvent?: { readonly isComposing?: boolean }
  preventDefault(): void
  stopPropagation(): void
}

export function textFieldKeysConnect(
  input: TextFieldKeysInput,
  send: (event: TextFieldOwnEvent) => void,
) {
  const empty = dataFlag(input.value === "")
  return {
    root: () => ({ "data-empty": empty }),
    /** Joined to Text Field's input props; `type` and `enterKeyHint` are defaults. */
    input: (): PartProps => ({
      ...(input.search
        ? {
            type: "search",
            enterkeyhint: "search",
            "data-custom-clear": dataFlag(input.customClear),
          }
        : {}),
      "data-empty": empty,
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
