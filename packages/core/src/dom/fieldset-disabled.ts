// "Inside a disabled fieldset", as HTML defines it for form controls: any ancestor
// <fieldset disabled>, except inside that fieldset's first <legend> child. Followed for
// every ancestor (not only the nearest) through one MutationObserver per document.

/** Whether `el` is disabled by an ancestor fieldset (HTML's first-legend exception applied). */
export function isFieldsetDisabled(el: Element): boolean {
  for (
    let fs = el.parentElement?.closest("fieldset");
    fs;
    fs = fs.parentElement?.closest("fieldset")
  ) {
    if (!fs.disabled && !fs.hasAttribute("disabled")) continue
    const legend = Array.from(fs.children).find((c) => c.tagName === "LEGEND")
    if (legend?.contains(el)) continue
    return true
  }
  return false
}

interface Watch {
  readonly el: Element
  last: boolean
  readonly onChange: (disabled: boolean) => void
}

const watchers = new WeakMap<
  Document,
  { readonly observer: MutationObserver; readonly watches: Set<Watch> }
>()

/**
 * Calls `onChange` whenever `el`'s fieldset-disabled state changes (a `disabled` attribute
 * toggled on any fieldset of the document). Returns the current state and a cleanup; does
 * nothing for an element with no fieldset ancestor.
 */
export function watchFieldsetDisabled(
  el: Element,
  onChange: (disabled: boolean) => void,
): { readonly disabled: boolean; readonly stop: () => void } {
  const disabled = isFieldsetDisabled(el)
  if (!el.closest("fieldset")) return { disabled, stop: () => {} }
  const doc = el.ownerDocument
  let entry = watchers.get(doc)
  if (!entry) {
    const watches = new Set<Watch>()
    const observer = new (doc.defaultView ?? globalThis).MutationObserver(() => {
      for (const w of watches) {
        const now = isFieldsetDisabled(w.el)
        if (now === w.last) continue
        w.last = now
        w.onChange(now)
      }
    })
    // childList too: moving a part into a disabled fieldset, or reordering its legends.
    observer.observe(doc, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled"],
    })
    entry = { observer, watches }
    watchers.set(doc, entry)
  }
  const watch: Watch = { el, last: disabled, onChange }
  const { watches, observer } = entry
  watches.add(watch)
  return {
    disabled,
    stop: () => {
      watches.delete(watch)
      if (watches.size === 0) {
        observer.disconnect()
        watchers.delete(doc)
      }
    },
  }
}
