import type { CollectionKey, MentionsEvent, mentionsConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { MentionsRenderState } from "./types"

export const mentionsHost = createContext<{
  readonly api: () => ReturnType<typeof mentionsConnect>
  readonly state: () => MentionsRenderState
  readonly send: (event: MentionsEvent) => void
  readonly open: () => boolean
  readonly highlightedKey: () => CollectionKey | null
  readonly selectOnTab: () => boolean
  readonly textarea: { current: HTMLTextAreaElement | null }
  readonly highlighter: { current: HTMLElement | null }
}>("mentions")
