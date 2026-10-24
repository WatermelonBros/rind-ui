/** @jsxImportSource solid-js */
// The same scenario rendered by @rind-ui/react and @rind-ui/solid must produce the same markup
// (canonical form: see canonicalHtml) after mount.
import { canonicalHtml } from "@rind-ui/testing"
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import type { JSX } from "solid-js"
import { render } from "solid-js/web"
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
export async function clientParity(react: ReactElement, solid: () => JSX.Element) {
  const expected = await reactSettled(react)
  const host = document.body.appendChild(document.createElement("div"))
  host.style.pointerEvents = "none"
  const dispose = render(solid, host)
  try {
    // Measured parts settle on a later frame.
    await vi.waitFor(() => expect(canonicalHtml(host)).toBe(expected))
  } finally {
    dispose()
    host.remove()
  }
}
