/** @jsxImportSource solid-js */
// Mounts a Solid tree for driver tests, disposed after each test (the counterpart of Testing
// Library's render + auto-cleanup).
import type { JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { render } from "solid-js/web"
import { afterEach } from "vitest"

const mounted = new Set<{ dispose: () => void; host: HTMLElement }>()
afterEach(() => {
  for (const m of mounted) {
    m.dispose()
    m.host.remove()
  }
  mounted.clear()
})

/**
 * Renders `ui(props)` with the props in a store, and returns a `rerender(next)` that sets them
 * (Solid updates synchronously), like Testing Library's rerender.
 */
export function mount<P extends object>(ui: (props: P) => JSX.Element, props = {} as P) {
  const [state, setState] = createStore<P>({ ...props })
  const host = document.body.appendChild(document.createElement("div"))
  const dispose = render(() => ui(state), host)
  mounted.add({ dispose, host })
  return {
    host,
    async rerender(next: Partial<P>) {
      // A store setter merges the object it is given.
      setState(next as never)
    },
  }
}
