import type { Chip, hiddenFormInput, tagsInputConnect } from "@rind-ui/core"
import { createContext } from "../context"

/** What the Root gives its parts; getters stay reactive. */
export interface TagsInputHost {
  readonly api: () => ReturnType<typeof tagsInputConnect>
  readonly chips: () => readonly Chip[]
  readonly editingKey: () => string | null
  readonly setDisabled: (key: string, on: boolean) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly setConstraint: (el: HTMLInputElement | null) => void
  readonly pending: { current: boolean }
  readonly tags: () => readonly string[]
  readonly reset: () => void
  readonly mountLabel: (on: boolean) => void
}
export const tagsInputHost = createContext<TagsInputHost>("tags-input")
export const tagsInputChip = createContext<() => Chip>("tags-input-chip")
