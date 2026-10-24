import type { Modality, ModalitySource } from "@rind-ui/core"
import { type Accessor, createComputed, createSignal, onCleanup } from "solid-js"

/**
 * The current modality, subscribed only while `active` (an instance with a focused part), so
 * a modality change updates focused instances only.
 */
export function useModality(source: ModalitySource, active: () => boolean): Accessor<Modality> {
  const [modality, setModality] = createSignal<Modality>(
    typeof document === "undefined" ? "keyboard" : source.modality(),
  )
  createComputed(() => {
    const on = active()
    setModality(source.modality())
    if (on) onCleanup(source.subscribe(() => setModality(source.modality())))
  })
  return modality
}
