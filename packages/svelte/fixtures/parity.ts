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
  const s = document.body.appendChild(document.createElement("div"))
  // Where the pointer rests (a previous test's last move) is not markup: hover stays out.
  r.style.pointerEvents = s.style.pointerEvents = "none"
  const root = createRoot(r)
  let app: ReturnType<typeof mount> | null = null
  try {
    await act(async () => root.render(react))
    app = mount(svelte, { target: s, props })
    flushSync()
    // Measured parts (Scroll Area) settle on a later frame, in either order: compare once both have.
    await vi.waitFor(() => expect(canonicalHtml(s)).toBe(canonicalHtml(r)))
  } finally {
    await act(async () => root.unmount())
    if (app) await unmount(app)
    r.remove()
    s.remove()
  }
}
