// The same scenario rendered by @rind-ui/react and @rind-ui/svelte must produce the same DOM
// after mount (canonical form: see canonicalHtml). Server markup is covered by the hydration
// tests, which need server builds.
import { canonicalHtml } from "@rind-ui/testing"
import type { ReactElement } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { type Component, flushSync, mount, unmount } from "svelte"
import { expect, vi } from "vitest"

/** React reads it to know `act` wraps the updates. */
const reactAct = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

export async function clientParity<P extends Record<string, unknown>>(
  react: ReactElement,
  svelte: Component<P>,
  props: P,
) {
  reactAct.IS_REACT_ACT_ENVIRONMENT = true
  const r = document.body.appendChild(document.createElement("div"))
  const root = createRoot(r)
  await act(async () => root.render(react))
  const s = document.body.appendChild(document.createElement("div"))
  const app = mount(svelte, { target: s, props })
  flushSync()
  // Measured parts (Scroll Area) settle on a later frame, in either order: compare once both have.
  await vi.waitFor(() => expect(canonicalHtml(s)).toBe(canonicalHtml(r)))
  await act(async () => root.unmount())
  await unmount(app)
  r.remove()
  s.remove()
}
