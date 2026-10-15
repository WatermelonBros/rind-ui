// Measured page moves (React Aria's visible-rect approach): from the item `key`, the item
// one visible area further in the list's scroll container. Null when nothing can be
// measured (jsdom reports zero rects), so the machine falls back to a fixed page size.

import { toKey } from "../collection/key"
import type { CollectionLayout, DomRoot } from "../env/capabilities"

/** The nearest scrolling ancestor of `el` (inclusive), else the list itself. */
function scroller(el: HTMLElement, list: HTMLElement): HTMLElement {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const style = n.ownerDocument.defaultView?.getComputedStyle(n)
    if (/auto|scroll/.test(style?.overflowY ?? "") && n.scrollHeight > n.clientHeight) return n
    if (n === list) break
  }
  return list
}

export function collectionLayout(dom: DomRoot): CollectionLayout {
  return {
    pageTarget(listId, key, direction) {
      const list = dom.getById(listId)
      if (!list) return null
      const items = Array.from(list.querySelectorAll<HTMLElement>("[data-key]"))
      const from = items.find((el) => el.getAttribute("data-key") === key)
      if (!from) return null
      const box = scroller(from, list).getBoundingClientRect()
      const start = from.getBoundingClientRect()
      if (box.height === 0 || start.height === 0) return null
      // One visible area further than the current item, clamped to the ends.
      const limit = direction === "next" ? start.top + box.height : start.bottom - box.height
      let target: HTMLElement | undefined
      for (const el of direction === "next" ? items : [...items].reverse()) {
        const r = el.getBoundingClientRect()
        const within = direction === "next" ? r.bottom <= limit + 0.5 : r.top >= limit - 0.5
        const beyond = direction === "next" ? r.top > start.top : r.top < start.top
        if (beyond && within) target = el
      }
      const k = (target ?? from).getAttribute("data-key")
      return k === null ? null : toKey(k)
    },
  }
}
