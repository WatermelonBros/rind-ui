// Named guard implementations machines list in `setup({ guards })`. They read the
// `modality` / `composing` fields rind-ui's interaction events carry.

import type { Modality } from "../contract/env"

interface GuardInput {
  readonly event: object
}

const modalityOf = (event: object): Modality | undefined =>
  "modality" in event ? (event.modality as Modality) : undefined

/** Passes for events produced by the keyboard. */
export const isKeyboard = ({ event }: GuardInput): boolean => modalityOf(event) === "keyboard"

/** Passes for events produced by assistive technology (bare click, cursor focus). */
export const isVirtual = ({ event }: GuardInput): boolean => modalityOf(event) === "virtual"

/** Keyboard or assistive technology: open-and-focus-first-item, select-on-focus decisions. */
export const isKeyboardOrVirtual = ({ event }: GuardInput): boolean => {
  const m = modalityOf(event)
  return m === "keyboard" || m === "virtual"
}

/**
 * Fails for key events produced while an IME composes. Apply it to every transition that
 * submits, selects, splits, dismisses, navigates or typeaheads on a key.
 */
export const notComposing = ({ event }: GuardInput): boolean =>
  !("composing" in event && event.composing === true)
