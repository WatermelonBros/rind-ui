import type { ClipboardEvent as CopyEvent, clipboardConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import type { ClipboardRenderState } from "./types"

export const clipboardContext = createContext<{
  readonly api: () => ReturnType<typeof clipboardConnect>
  readonly send: (event: CopyEvent) => void
  readonly state: () => ClipboardRenderState
  readonly copyAnchor: { current: HTMLElement | null }
  readonly registry: PartRegistry<"label" | "input">
  readonly ids: () => { readonly label: string; readonly input: string }
}>("clipboard")

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
export function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return {
    env,
    get focused() {
      return focused
    },
    set focused(on: boolean) {
      focused = on
    },
    get modality() {
      return modality.current
    },
  }
}
