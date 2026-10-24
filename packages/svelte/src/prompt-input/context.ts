import type { PromptAttachment, PromptInputApi, promptInputIds } from "@rind-ui/core"
import { createContext } from "../context"
import type { PromptInputControl } from "./types"

export interface CountState {
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

export const promptInput = createContext<{
  readonly api: () => PromptInputApi
  readonly ids: () => ReturnType<typeof promptInputIds>
  readonly value: () => string
  readonly controlled: () => boolean
  readonly defaultValue: () => string
  readonly attachments: () => readonly PromptAttachment[]
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly name: () => string
  readonly control: PromptInputControl
  readonly setCount: (c: CountState | null) => void
  readonly count: () => { readonly used: number; readonly max: number | undefined } | null
  readonly setTextareaId: (id: string) => void
  readonly textarea: { current: HTMLTextAreaElement | null }
  readonly mounted: { textareas: number; submits: number }
}>("prompt-input")

/** One attachment, for the chip parts inside PromptInput.Attachments. */
export const promptChip =
  createContext<
    () => {
      readonly key: string
      readonly attachment: PromptAttachment
    }
  >("prompt-input-chip")

/** The Prompt Input's state and actions, from inside `PromptInput.Root` (call at init). */
export function usePromptInput(): PromptInputControl {
  return promptInput.get().control
}
