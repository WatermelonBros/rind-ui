// The same scenario rendered by @rind-ui/react and @rind-ui/vue must produce the same markup
// (canonical form: see canonicalHtml), on the server and after mount.
import { canonicalHtml } from "@rind-ui/testing"
import type { ReactElement } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString as reactToString } from "react-dom/server"
import { expect, vi } from "vitest"
import { createApp, createSSRApp, nextTick, type VNode } from "vue"
import { renderToString as vueToString } from "vue/server-renderer"

/** React reads it to know `act` wraps the updates. */
const reactAct = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

/** Server HTML of both, canonical. */
export async function serverParity(react: ReactElement, vue: () => VNode | VNode[]) {
  const expected = canonicalHtml(reactToString(react))
  const actual = canonicalHtml(await vueToString(createSSRApp({ render: vue })))
  expect(actual).toBe(expected)
}

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

let apps = 0

/**
 * The DOM of both after mount (effects run), canonical. One after the other: two instances in
 * one document would see each other (the same ids, a modal's inert outside, focus).
 */
export async function clientParity(react: ReactElement, vue: () => VNode | VNode[]) {
  const expected = await reactSettled(react)
  const v = document.body.appendChild(document.createElement("div"))
  v.style.pointerEvents = "none"
  const app = createApp({ render: vue })
  // Every app's useId restarts at v-0: an app left by a failed attempt would own the ids.
  app.config.idPrefix = `parity${apps++}`
  try {
    app.mount(v)
    await nextTick()
    // Measured parts (Scroll Area) settle on a later frame.
    await vi.waitFor(() => expect(canonicalHtml(v)).toBe(expected))
  } finally {
    app.unmount()
    v.remove()
  }
}
