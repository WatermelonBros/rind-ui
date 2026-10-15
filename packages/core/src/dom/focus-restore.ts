// Focus restore on close, with a fallback chain so focus never ends on `body`: the consumer's
// choice, the opener or the element focused before opening, the most recent connected element
// of the bounded focus history the modality tracker keeps (react-spectrum#2444), the parent layer's container. Only when
// focus is inside the closing layer or on `body` (radix#2942), never into an inert subtree,
// and synchronously: no timer survives teardown (radix#4148).

import { focusSafely } from "./focus-safely"
import { deepActiveElement, type FocusEnv, type FocusTarget } from "./focus-scope"
import { getLayerStack, type LayerHandle } from "./layer-stack"

export interface FocusReturn {
  /** Restores focus (call after outside hiding is removed). */
  restore(pick?: () => FocusTarget): void
}

/** Connected, not inert, not hidden, and focusable. */
function usable(el: Element | null | undefined): el is HTMLElement {
  if (!el?.isConnected || !(el instanceof HTMLElement)) return false
  if (el.closest("[inert]") || el.closest("[hidden]")) return false
  if (el.matches(":disabled")) return false
  return el.tabIndex >= 0 || el.hasAttribute("tabindex")
}

/**
 * Captures where focus returns when `layer` closes: call when it opens. `opener` is the
 * trigger (the first candidate: a layer open at mount had nothing focused before it,
 * react-spectrum#10661).
 */
export function captureFocus(
  env: FocusEnv,
  layer: LayerHandle,
  doc: Document,
  opener?: () => Element | null,
): FocusReturn {
  const before = deepActiveElement(doc)
  const parentId = layer.parentId
  return {
    restore(pick) {
      const active = deepActiveElement(doc)
      const onBody = !active || active === doc.body
      // Focus the user moved elsewhere (a text field on the page) stays there.
      if (!onBody && !layer.contains(active)) return
      const chosen = pick?.() ?? null
      if (chosen === false) return
      const parent = parentId ? getLayerStack(doc).options(parentId)?.elements()[0] : undefined
      // The parent layer's container is the last resort: focusable like any layer container.
      if (parent instanceof HTMLElement && !parent.hasAttribute("tabindex")) {
        parent.setAttribute("tabindex", "-1")
      }
      const candidates: (Element | null | undefined)[] = [
        chosen,
        opener?.(),
        before === doc.body ? null : before,
        // The modality tracker's history, most recent first, outside the closing layer.
        ...env.modality.recentFocus().filter((el) => !layer.contains(el)),
        parent,
      ]
      const target = candidates.find(usable)
      if (target) void focusSafely(target, env, "layer")
    },
  }
}
