// Long press is an option of createPress (500 ms through the scheduler, trailing PRESS and
// touch context menu suppressed). This module adds what a long-pressable part renders: a
// localised hint, referenced by aria-describedby, so the gesture is discoverable to AT.

/** English default; components expose it in their `messages`. */
export const longPressMessages = {
  longPressHint: "Long press for more options",
} as const

/** Adds the hint's id to the part's existing description ids. */
export function describedByHint(hintId: string, describedBy?: string): string {
  return describedBy ? `${describedBy} ${hintId}` : hintId
}
