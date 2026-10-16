// The content of an open non-modal layer sits in the Tab order right after its trigger,
// wherever it is rendered (a portal at the end of body): Tab on the trigger enters it, Tab
// past its end continues after the trigger, Shift+Tab from its start goes back to the
// trigger. Key handling only — no focusable sentinels (axe and VoiceOver trip on them,
// mui/base-ui#5715) and no focusin redirection. Modal layers wrap Tab instead (focus-scope).

import { focusSafely } from "./focus-safely"
import { containsDeep, deepActiveElement, type FocusEnv, stopsOf as stops } from "./focus-scope"
import { getLayerStack, type LayerHandle } from "./layer-stack"

export interface NonModalTabOrderOptions {
  readonly trigger: () => HTMLElement | null
  readonly content: () => HTMLElement | null
  /** The layer: its elements and descendant layers are skipped when leaving forward. */
  readonly layer: LayerHandle
}

type Env = FocusEnv

/** Follows Tab and Shift+Tab on the trigger and inside the content; returns the cleanup. */
export function trackNonModalTabOrder(env: Env, o: NonModalTabOrderOptions): () => void {
  const root = env.dom.getRootNode()
  const doc = "body" in root ? root : root.ownerDocument
  const move = (e: KeyboardEvent, target: HTMLElement) => {
    e.preventDefault()
    void focusSafely(target, env, "navigation")
  }
  /** The first tab stop after the trigger in the page's order, outside this layer. */
  const afterTrigger = (trigger: HTMLElement) => {
    const order = stops(env, doc.body)
    const at = order.indexOf(trigger)
    if (at < 0) return undefined
    return order.slice(at + 1).find((el) => !o.layer.contains(el))
  }
  const stack = getLayerStack(doc)
  /** Inside the content of a layer opened from this one: that layer's own handler decides. */
  const inDescendant = (active: Element) =>
    stack.layers().some((l) => {
      if (l.id === o.layer.id) return false
      let p = l.parentId
      while (p && p !== o.layer.id) p = stack.get(p)?.parentId
      const container = stack.options(l.id)?.container?.()
      return p === o.layer.id && container != null && containsDeep(container, active)
    })
  const skip = (e: KeyboardEvent) =>
    e.key !== "Tab" || e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey
  // On the trigger element itself: it runs before a parent layer's document listener, so a
  // trigger inside another non-modal layer enters its own content first.
  const onTriggerKeyDown = (e: KeyboardEvent) => {
    const content = o.content()
    if (skip(e) || e.shiftKey || !content) return
    const first = stops(env, content)[0]
    if (first) move(e, first)
  }
  // Bubble phase on the document: a widget inside the content that handles Tab itself
  // (preventDefault) has already run.
  const onKeyDown = (e: KeyboardEvent) => {
    if (skip(e)) return
    const trigger = o.trigger()
    const content = o.content()
    const active = deepActiveElement(doc)
    if (!trigger || !content || !active || !containsDeep(content, active)) return
    if (inDescendant(active)) return
    const inner = stops(env, content)
    if (e.shiftKey) {
      if (active === content || active === inner[0]) move(e, trigger)
      return
    }
    if (active === inner.at(-1) || (active === content && inner.length === 0)) {
      // Nothing follows the trigger: left to the browser (focus goes to its chrome).
      const next = afterTrigger(trigger)
      if (next) move(e, next)
    }
  }
  const trigger = o.trigger()
  trigger?.addEventListener("keydown", onTriggerKeyDown)
  doc.addEventListener("keydown", onKeyDown)
  return () => {
    trigger?.removeEventListener("keydown", onTriggerKeyDown)
    doc.removeEventListener("keydown", onKeyDown)
  }
}
