import type { MessageThreadEvent, messageThreadConnect, StickController } from "@rind-ui/core"
import { createContext } from "../context"
import type { MessageThreadRenderState } from "./types"

export const messageThread = createContext<{
  readonly api: () => ReturnType<typeof messageThreadConnect>
  readonly state: () => MessageThreadRenderState
  readonly send: (event: MessageThreadEvent) => void
  readonly threshold: () => number
  readonly loadingOlder: () => boolean
  readonly loadOlder: () => void
  readonly setAtBottom: (at: boolean) => void
  /** The Viewport's controller, set while it is mounted. */
  readonly stick: { current: StickController | null }
  readonly viewport: { current: HTMLElement | null }
  readonly turn: { current: ((b: "smooth" | "instant") => void) | null }
}>("message-thread")

export const articles = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>('[data-part="message"]'))

export const isNamed = (attrs: Record<string, unknown>) =>
  attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
