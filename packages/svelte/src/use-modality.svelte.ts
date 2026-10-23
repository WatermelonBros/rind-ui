import type { Modality, ModalitySource } from "@rind-ui/core"

/**
 * The current modality, subscribed only while `active` (an instance with a focused part), so
 * a modality change updates focused instances only. Read `.current`.
 */
export function useModality(source: ModalitySource, active: () => boolean) {
  let modality = $state<Modality>("keyboard")
  $effect(() => {
    modality = source.modality()
    if (!active()) return
    return source.subscribe(() => (modality = source.modality()))
  })
  return {
    get current() {
      return modality
    },
  }
}
