import { createAttachmentKey } from "svelte/attachments"

/**
 * The element a part renders, captured by an attachment the part spreads with its props (so
 * it also lands on an element the consumer renders through the `child` snippet). Read
 * `.current` and `.tag` (lowercase, `fallback` until mounted).
 */
export function elementRef(fallback: string | (() => string)) {
  let el = $state<Element | null>(null)
  const key = createAttachmentKey()
  return {
    get current() {
      return el
    },
    get tag() {
      return el?.tagName.toLowerCase() ?? (typeof fallback === "string" ? fallback : fallback())
    },
    props: {
      [key]: (node: Element) => {
        el = node
        return () => {
          if (el === node) el = null
        }
      },
    },
  }
}
