import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"

/** A part's own focus, tracked from mount so the focusing press is already known. */
export function useFocusState() {
  const env = useEnvironment()
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return {
    focus: () => ({ focused, modality: modality.current }),
    // Only the part itself, not a descendant (a message's own buttons).
    handlers: {
      onfocusin: (e: FocusEvent) => {
        focused = e.target === e.currentTarget
      },
      onfocusout: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused = false
      },
    },
  }
}
