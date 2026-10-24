/**
 * Keeps focus on an element inside the container that a keyed `{#each}` moved (a move is a
 * remove and an insert, which blurs it). React restores the focused element after every
 * commit; Svelte does not, so a part whose children reorder calls this with what they read.
 */
export function useKeepFocus(container: () => Element | null, rows: () => unknown): void {
  let focused: HTMLElement | null = null
  $effect.pre(() => {
    rows()
    const active = container()?.ownerDocument.activeElement
    // The blur of the move can start a nested update before this one ends: it keeps the element.
    if (active instanceof HTMLElement && container()?.contains(active)) focused = active
  })
  $effect(() => {
    rows()
    const el = focused
    focused = null
    if (el?.isConnected && el.ownerDocument.activeElement !== el) el.focus({ preventScroll: true })
  })
}
