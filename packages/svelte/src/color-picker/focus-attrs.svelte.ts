import { focusAttrs } from "@rind-ui/core"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"

/** `data-focus` / `data-focus-visible` for a picker-owned control, with its focus handlers. */
export function useFocusAttrs() {
  const env = useEnvironment()
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return () => ({
    ...focusAttrs(focused, modality.current),
    onfocus: () => {
      focused = true
    },
    onblur: () => {
      focused = false
    },
  })
}
