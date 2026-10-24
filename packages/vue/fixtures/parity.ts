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

/** The DOM of both after mount (effects run), canonical. */
export async function clientParity(react: ReactElement, vue: () => VNode | VNode[]) {
  reactAct.IS_REACT_ACT_ENVIRONMENT = true
  const r = document.body.appendChild(document.createElement("div"))
  const root = createRoot(r)
  await act(async () => root.render(react))
  const v = document.body.appendChild(document.createElement("div"))
  const app = createApp({ render: vue })
  app.mount(v)
  await nextTick()
  // Measured parts (Scroll Area) settle on a later frame, in either order: compare once both have.
  await vi.waitFor(() => expect(canonicalHtml(v)).toBe(canonicalHtml(r)))
  await act(async () => root.unmount())
  app.unmount()
  r.remove()
  v.remove()
}
