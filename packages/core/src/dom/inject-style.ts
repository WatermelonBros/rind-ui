// The one way rind-ui adds CSS to a page: a <style> per document and rule-set id, in the
// document's head, wrapped in an anonymous cascade layer (any consumer rule wins), with the
// environment's CSP nonce. Each document (iframe, popup window) gets its own element; on
// the server it does nothing. The test reset removes every element it inserted.

import type { StyleEnv } from "../env/capabilities"
import { registerReset } from "./resets"

const injected = new Set<HTMLStyleElement>()
registerReset(() => {
  for (const style of injected) style.remove()
  injected.clear()
})

/** Inserts `css` (rules, without a layer) into `doc` once for `id`. */
export function injectStyle(
  doc: Document | null | undefined,
  id: string,
  css: string,
  env: Partial<StyleEnv> = {},
): void {
  if (!doc?.head) return
  if (doc.head.querySelector(`style[data-rind-style="${CSS.escape(id)}"]`)) return
  const style = doc.createElement("style")
  injected.add(style)
  const nonce = env.style?.nonce
  // The attribute too: some DOMs (jsdom) do not reflect the `nonce` property.
  if (nonce) {
    style.nonce = nonce
    style.setAttribute("nonce", nonce)
  }
  style.setAttribute("data-rind-style", id)
  style.textContent = `@layer { ${css} }`
  doc.head.append(style)
}
