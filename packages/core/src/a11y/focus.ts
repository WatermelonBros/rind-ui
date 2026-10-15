// Focus attributes connect puts on focusable parts.

import type { Modality } from "../contract/env"
import type { ModalitySource } from "../env/capabilities"
import type { BlurEvent, FocusEvent } from "./events"

/**
 * `data-focus` while the part has focus (DOM focus, or the highlight of an
 * aria-activedescendant composite), `data-focus-visible` when, in addition, the modality is
 * not pointer or touch. Typing in a text field after a click keeps the modality `pointer`
 * (the tracker's text-input rule), so it never turns the ring on.
 */
export function focusAttrs(focused: boolean, modality: Modality) {
  return {
    "data-focus": focused ? "" : undefined,
    "data-focus-visible":
      focused && modality !== "pointer" && modality !== "touch" ? "" : undefined,
  } as const
}

/** The FOCUS event for a part that just received DOM focus, with its modality and cause. */
export function focusEvent(el: Element, source: ModalitySource): FocusEvent {
  return { type: "FOCUS", modality: source.modality(), cause: source.focusCause(el) }
}

export function blurEvent(source: ModalitySource): BlurEvent {
  return { type: "BLUR", modality: source.modality() }
}
