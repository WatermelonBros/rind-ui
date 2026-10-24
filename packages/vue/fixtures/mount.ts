// Mounts a Vue tree for driver tests, unmounted after each test (the counterpart of Testing
// Library's render + auto-cleanup).
import { afterEach } from "vitest"
import { type App, type Component, createApp, type h, nextTick, reactive } from "vue"

const mounted = new Set<{ app: App; host: HTMLElement }>()
afterEach(() => {
  for (const m of mounted) {
    m.app.unmount()
    m.host.remove()
  }
  mounted.clear()
})

/**
 * Renders `ui(props)` and returns a `rerender(next)` that patches the props reactively
 * (awaiting Vue's flush), like Testing Library's rerender.
 */
export function mount<P extends object>(ui: (props: P) => ReturnType<typeof h>, props = {} as P) {
  const state = reactive({ ...props }) as P
  const host = document.body.appendChild(document.createElement("div"))
  const Root: Component = { setup: () => () => ui(state) }
  const app = createApp(Root)
  app.mount(host)
  mounted.add({ app, host })
  return {
    host,
    async rerender(next: Partial<P>) {
      Object.assign(state, next)
      await nextTick()
    },
  }
}
