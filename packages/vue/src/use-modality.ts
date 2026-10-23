import type { Modality, ModalitySource } from "@rind-ui/core"
import { onScopeDispose, type Ref, shallowRef, watch } from "vue"

/**
 * The current modality, subscribed only while `active` (an instance with a focused part), so
 * a modality change updates focused instances only.
 */
export function useModality(source: ModalitySource, active: () => boolean): Ref<Modality> {
  const modality = shallowRef<Modality>(
    typeof document === "undefined" ? "keyboard" : source.modality(),
  )
  let off: (() => void) | undefined
  watch(
    active,
    (on) => {
      off?.()
      off = undefined
      modality.value = source.modality()
      if (on) off = source.subscribe(() => (modality.value = source.modality()))
    },
    { immediate: true },
  )
  onScopeDispose(() => off?.())
  return modality
}
