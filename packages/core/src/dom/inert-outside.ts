// Everything outside the topmost modal layer becomes `inert` (never aria-hidden, never body
// pointer-events): the siblings of each element on the path from <body> to every kept
// element are marked. Kept: the topmost modal and its descendant layers, plus whatever the
// one keep-visible rule exposes (announcer, top-layer regions, live regions). Nodes added
// later are left alone (password managers, extensions: radix#2219). Marks are reference
// counted on the document, so overlapping layers and two copies of @rind-ui/core never
// remove each other's, and the author's own `inert` survives.

import { KEEP_VISIBLE_SELECTOR } from "./keep-visible"
import { getLayerStack, type LayerHandle, type LayerStack } from "./layer-stack"
import { registerReset } from "./resets"

const SKIPPED = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK"])

interface Marks {
  readonly counts: WeakMap<Element, number>
  /** Elements whose `inert` the author set: never removed. */
  readonly authored: WeakSet<Element>
  /** The stack-driven singleton's teardown, once installed. */
  uninstall: (() => void) | null
}
const KEY = Symbol.for("rind-ui.inert-outside@1")

function marksOf(doc: Document): Marks {
  let marks = Reflect.get(doc, KEY) as Marks | undefined
  if (!marks) {
    marks = { counts: new WeakMap(), authored: new WeakSet(), uninstall: null }
    Reflect.set(doc, KEY, marks)
  }
  return marks
}

registerReset(() => {
  if (typeof document === "undefined") return
  ;(Reflect.get(document, KEY) as Marks | undefined)?.uninstall?.()
  Reflect.deleteProperty(document, KEY)
})

function mark(marks: Marks, el: Element) {
  const count = marks.counts.get(el) ?? 0
  if (count === 0) {
    if (el.hasAttribute("inert")) marks.authored.add(el)
    else el.setAttribute("inert", "")
  }
  marks.counts.set(el, count + 1)
}
function unmark(marks: Marks, el: Element) {
  const count = marks.counts.get(el) ?? 0
  if (count === 0) return
  if (count > 1) {
    marks.counts.set(el, count - 1)
    return
  }
  marks.counts.delete(el)
  if (marks.authored.has(el)) marks.authored.delete(el)
  else el.removeAttribute("inert")
}

/** The light-DOM element that holds `el` in the document: its outermost shadow host, or itself. */
function outermostHost(el: Element): Element {
  let node = el
  for (let root = node.getRootNode(); root instanceof ShadowRoot; root = node.getRootNode()) {
    node = root.host
  }
  return node
}

/**
 * Marks the siblings along every path from <body> to the kept elements; returns the undo.
 * With `existing`, only nodes in it are marked (nodes added since the snapshot are left alone).
 */
export function inertOutside(
  doc: Document,
  keep: readonly Element[],
  existing?: { has(el: Element): boolean },
): () => void {
  const body = doc.body
  if (!body) return () => {}
  const marks = marksOf(doc)
  // Kept elements inside an open shadow root are not in `body.contains`: use their host.
  const kept = [...keep, ...Array.from(doc.querySelectorAll(KEEP_VISIBLE_SELECTOR))]
    .map(outermostHost)
    .filter((el) => el !== body && body.contains(el))
  // Every kept element and its ancestors up to <body>: never marked.
  const onPath = new Set<Element>()
  for (const el of kept) {
    for (let n: Element | null = el; n && n !== body; n = n.parentElement) onPath.add(n)
  }
  const marked: Element[] = []
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (SKIPPED.has(child.tagName)) continue
      if (kept.includes(child)) continue
      if (onPath.has(child)) visit(child)
      else if (!existing || existing.has(child)) {
        mark(marks, child)
        marked.push(child)
      }
    }
  }
  if (kept.length > 0) visit(body)
  return () => {
    for (const el of marked) unmark(marks, el)
  }
}

/**
 * A layer's elements, without nulls: a stale layer (its DOM replaced without a release) may
 * return them despite its type, and one throw here would stop every stack subscriber.
 */
const elementsOf = (stack: LayerStack, layer: LayerHandle): Element[] =>
  (stack.options(layer.id)?.elements() ?? []).filter((el): el is Element => el != null)

/** The topmost modal layer's elements and its descendant layers' elements. */
function keptBy(stack: LayerStack, top: LayerHandle): Element[] {
  const descends = (layer: LayerHandle) => {
    for (let id = layer.parentId; id; id = stack.get(id)?.parentId) if (id === top.id) return true
    return false
  }
  return [top, ...stack.layers().filter(descends)].flatMap((layer) => elementsOf(stack, layer))
}

/**
 * Installs the document's outside-hiding singleton (idempotent): recomputed synchronously on
 * every stack change, so a closing layer's marks are gone before focus is restored
 * (react-spectrum#10610). Closing content is inert until its presence completes.
 */
export function hideOutsideModal(doc: Document): void {
  const marks = marksOf(doc)
  if (marks.uninstall) return
  const stack = getLayerStack(doc)
  let undoOutside: (() => void) | null = null
  let undoExiting: (() => void) | null = null
  let topId: string | undefined
  /** What the last walk kept: a layer's elements can mount after it opened. */
  let lastKept: readonly Element[] = []
  let exitingIds = ""
  /** Elements present when the outermost modal opened; later walks mark only these, so nodes
   * added while it is open (a descendant layer's portal, a password manager) stay exposed. */
  let existing: WeakSet<Element> | null = null
  const recompute = () => {
    const top = stack.topmostModal()
    const kept = top ? keptBy(stack, top) : []
    const keptChanged = kept.length !== lastKept.length || kept.some((el, i) => el !== lastKept[i])
    if (top?.id !== topId || keptChanged) {
      const previous = undoOutside
      if (!top) existing = null
      else if (!existing && kept.length > 0) existing = new WeakSet(doc.body.querySelectorAll("*"))
      // New marks first, then the old ones removed: nothing is exposed in between.
      undoOutside = top && kept.length > 0 ? inertOutside(doc, kept, existing ?? undefined) : null
      previous?.()
      topId = top?.id
      lastKept = kept
    }
    const exiting = stack.exiting()
    const ids = exiting.map((l) => l.id).join("|")
    if (ids !== exitingIds) {
      const previous = undoExiting
      const own = exiting.flatMap((l) => elementsOf(stack, l))
      for (const el of own) mark(marks, el)
      undoExiting = () => {
        for (const el of own) unmark(marks, el)
      }
      previous?.()
      exitingIds = ids
    }
  }
  const unsubscribe = stack.subscribe(recompute)
  marks.uninstall = () => {
    unsubscribe()
    undoOutside?.()
    undoExiting?.()
    marks.uninstall = null
  }
  recompute()
}
