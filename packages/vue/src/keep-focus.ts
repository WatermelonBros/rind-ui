import { onBeforeUpdate, onUpdated, type ShallowRef } from "vue"

/**
 * Keeps focus on an element inside `container` that a keyed patch moved (a move is a remove
 * and an insert, which blurs it). React restores the focused element after every commit;
 * Vue does not, so a part whose children reorder calls this in setup.
 */
export function useKeepFocus(container: ShallowRef<Element | null>): void {
  let focused: HTMLElement | null = null
  onBeforeUpdate(() => {
    const active = container.value?.ownerDocument.activeElement
    // The blur of the move can start a nested update before this one ends: it keeps the element.
    if (active instanceof HTMLElement && container.value?.contains(active)) focused = active
  })
  onUpdated(() => {
    const el = focused
    focused = null
    if (el?.isConnected && el.ownerDocument.activeElement !== el) el.focus({ preventScroll: true })
  })
}
