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

/** A frame of the page's (measured parts write on one). */
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()))

/** React's DOM, canonical, once two frames pass without a change (measured parts settled). */
export async function reactSettled(react: ReactElement): Promise<string> {
  reactAct.IS_REACT_ACT_ENVIRONMENT = true
  const r = document.body.appendChild(document.createElement("div"))
  // Where the pointer rests (a previous test's last move) is not markup: hover stays out.
  r.style.pointerEvents = "none"
  const root = createRoot(r)
  try {
    await act(async () => root.render(react))
    let last = canonicalHtml(r)
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await frame()
        await frame()
      })
      const next = canonicalHtml(r)
      if (next === last) break
      last = next
    }
    return last
  } finally {
    await act(async () => root.unmount())
    r.remove()
  }
}

/**
 * The DOM of both after mount (effects run), canonical. One after the other: two instances in
 * one document would see each other (the same ids, a modal's inert outside, focus).
 */
export async function clientParity<P extends Record<string, unknown>>(
  react: ReactElement,
  svelte: Component<P>,
  props: P,
) {
  const expected = await reactSettled(react)
  const s = document.body.appendChild(document.createElement("div"))
  s.style.pointerEvents = "none"
  let app: ReturnType<typeof mount> | null = null
  try {
    app = mount(svelte, { target: s, props })
    flushSync()
    // Measured parts (Scroll Area) settle on a later frame.
    await vi.waitFor(() => expect(canonicalHtml(s)).toBe(expected))
  } finally {
    if (app) await unmount(app)
    s.remove()
  }
}
