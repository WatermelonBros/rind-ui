import type { MessageActionsEvent, messageActionsConnect } from "@rind-ui/core"
import { createContext } from "../context"

export const messageActionsContext = createContext<{
  readonly api: () => ReturnType<typeof messageActionsConnect>
  readonly send: (event: MessageActionsEvent) => void
  readonly editEl: { current: HTMLElement | null }
}>("message-actions")

/** Toolbar props carry the toolbar's scope: the part's own scope replaces it. */
export function withoutScope(props: Record<string, unknown>) {
  const { "data-scope": _s, "data-part": _p, "data-instance": _i, ...rest } = props
  return rest
}
