// Mounts a Svelte component for driver tests, unmounted after each test (the counterpart of
// Testing Library's render + auto-cleanup). `rerender` patches props through a $state proxy.
import { type Component, flushSync, mount as svelteMount, unmount } from "svelte"
import { afterEach } from "vitest"
import { reactiveProps } from "./reactive-props.svelte"

const mounted = new Set<{ app: object; host: HTMLElement }>()
afterEach(() => {
  for (const m of mounted) {
    void unmount(m.app)
    m.host.remove()
  }
  mounted.clear()
})

export function mount<P extends Record<string, unknown>>(component: Component<P>, props = {} as P) {
  const state = reactiveProps(props)
  const host = document.body.appendChild(document.createElement("div"))
  const app = svelteMount(component, { target: host, props: state })
  flushSync()
  mounted.add({ app, host })
  return {
    host,
    rerender(next: Partial<P>) {
      Object.assign(state, next)
      flushSync()
    },
  }
}
