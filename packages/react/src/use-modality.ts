import type { Modality, ModalitySource } from "@rind-ui/core"
import { useSyncExternalStore } from "react"

const noop = () => () => {}

/**
 * The current modality, subscribed only while `active` (an instance with a focused part),
 * so a modality change re-renders focused instances only — and never by blurring and
 * re-focusing anything.
 */
export function useModality(source: ModalitySource, active: boolean): Modality {
  return useSyncExternalStore(
    active ? source.subscribe : noop,
    () => source.modality(),
    () => "keyboard",
  )
}
