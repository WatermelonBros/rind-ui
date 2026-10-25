import { type Accessor, createComputed, createEffect, on } from "solid-js"

/**
 * Keeps focus on an element inside `container` that a keyed update moved (a move is a remove
 * and an insert, which blurs it). React restores the focused element after every commit; a
 * part whose children reorder calls this with the value that changes when they do. The
 * computation runs before the DOM updates, the effect after.
 */
export function useKeepFocus(container: Accessor<Element | null>, watch: Accessor<unknown>): void {
  let focused: HTMLElement | null = null
  createComputed(
    on(
      watch,
      () => {
        const node = container()
        const active = node?.ownerDocument.activeElement
        focused = active instanceof HTMLElement && node?.contains(active) ? active : null
      },
      { defer: true },
    ),
  )
  createEffect(
    on(
      watch,
      () => {
        const el = focused
        focused = null
        if (el?.isConnected && el.ownerDocument.activeElement !== el)
          el.focus({ preventScroll: true })
      },
      { defer: true },
    ),
  )
}
