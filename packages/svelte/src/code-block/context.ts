import type { CodeBlockEvent, codeBlockConnect, TrustedCodeHtml } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { CodeBlockLine, CodeBlockRenderState, CodeToken } from "./types"

export const codeBlockContext = createContext<{
  readonly api: () => ReturnType<typeof codeBlockConnect>
  readonly send: (event: CodeBlockEvent) => void
  readonly state: () => CodeBlockRenderState
  readonly lines: () => readonly CodeBlockLine[]
  readonly tokens: () => readonly (readonly CodeToken[])[] | undefined
  readonly html: () => TrustedCodeHtml | undefined
  readonly copyAnchor: { current: HTMLElement | null }
  readonly registry: PartRegistry<"title">
  readonly titleId: () => string
}>("code-block")
