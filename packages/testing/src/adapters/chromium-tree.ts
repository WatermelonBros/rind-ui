// Chromium's computed accessibility tree through the DevTools protocol (types-only
// Playwright import). Where a browser's tree differs from the in-page name computation,
// screen readers follow the browser: RA#9737 (names through inert), RA#8915 (description
// targets), RX#4115 (popups exposed).

import type { CDPSession, Page } from "playwright"

export interface AxNode {
  readonly role: string
  readonly name: string
  readonly description: string
  readonly ignored: boolean
  readonly ignoredReasons: readonly string[]
}
export interface Unavailable {
  readonly unavailable: true
}

interface RawAxNode {
  readonly role?: { readonly value?: string }
  readonly name?: { readonly value?: string }
  readonly description?: { readonly value?: string }
  readonly ignored?: boolean
  readonly ignoredReasons?: readonly { readonly name: string }[]
}
const toNode = (n: RawAxNode): AxNode => ({
  role: n.role?.value ?? "",
  name: n.name?.value ?? "",
  description: n.description?.value ?? "",
  ignored: n.ignored === true,
  ignoredReasons: (n.ignoredReasons ?? []).map((r) => r.name),
})

const sessions = new WeakMap<Page, Promise<CDPSession | null>>()
function session(page: Page): Promise<CDPSession | null> {
  let s = sessions.get(page)
  if (!s) {
    s = (async () => {
      if (page.context().browser()?.browserType().name() !== "chromium") return null
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Accessibility.enable")
      await cdp.send("DOM.enable")
      return cdp
    })().catch(() => null)
    sessions.set(page, s)
  }
  return s
}

export interface ChromiumTreeOptions {
  /** Retry until the tree satisfies this (default: Chromium returned a tree). */
  readonly until?: (nodes: readonly AxNode[]) => boolean
  /** Default 5000 ms. */
  readonly timeout?: number
}

/**
 * Chromium's full accessibility tree, retried until it satisfies `until` (the tree updates
 * after the DOM, so a fresh change may not be in it yet); `{ unavailable: true }` in other
 * engines. Throws when `until` still fails after `timeout` ms.
 */
export async function chromiumTree(
  page: Page,
  { until = (nodes) => nodes.length > 0, timeout = 5000 }: ChromiumTreeOptions = {},
): Promise<readonly AxNode[] | Unavailable> {
  const cdp = await session(page)
  if (!cdp) return { unavailable: true }
  const start = Date.now()
  for (;;) {
    const { nodes } = (await cdp
      .send("Accessibility.getFullAXTree")
      .catch(() => ({ nodes: [] }))) as { nodes: RawAxNode[] }
    const tree = nodes.map(toNode)
    if (until(tree)) return tree
    if (Date.now() - start >= timeout) {
      throw new Error(`chromiumTree: the accessibility tree did not match within ${timeout} ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

/** The accessibility node of the element a page expression evaluates to. */
export async function axNodeOf(
  page: Page,
  expression: string,
): Promise<AxNode | Unavailable | null> {
  const cdp = await session(page)
  if (!cdp) return { unavailable: true }
  await cdp.send("DOM.getDocument", { depth: 0 })
  const { result } = (await cdp.send("Runtime.evaluate", { expression })) as {
    result: { objectId?: string }
  }
  if (!result.objectId) return null
  const { nodeId } = (await cdp.send("DOM.requestNode", { objectId: result.objectId })) as {
    nodeId: number
  }
  const { nodes } = (await cdp.send("Accessibility.getPartialAXTree", {
    nodeId,
    fetchRelatives: false,
  })) as { nodes: RawAxNode[] }
  const first = nodes[0]
  return first ? toNode(first) : null
}
