// The DOM clipboard (spec clipboard "DOM Clipboard Implementation"): the Clipboard API, checked at
// call time (absent in insecure contexts: docusaurus#11791), else a temporary textarea copied with
// execCommand. The textarea goes next to `near`, so it is inside the trigger's layer: a modal
// dialog makes everything outside it inert, where a selection cannot be copied (docusaurus#11109).

import type { Clipboard } from "../env/capabilities"
import { applyVisuallyHidden } from "./visually-hidden"

interface ClipboardApi {
  writeText(text: string): Promise<void>
}

const api = (doc: Document): ClipboardApi | undefined => {
  const c = (doc.defaultView?.navigator as { clipboard?: unknown } | undefined)?.clipboard
  // Sound: an object with a writeText function is the API (or a test's fake of it).
  return typeof (c as { writeText?: unknown } | undefined)?.writeText === "function"
    ? (c as ClipboardApi)
    : undefined
}

/** Copies through a temporary selection; restores the previous selection and focus. */
export function copyWithSelection(doc: Document, text: string, near?: Element): boolean {
  const active = doc.activeElement as HTMLElement | null
  const selection = doc.getSelection()
  const ranges: Range[] = []
  for (let i = 0; i < (selection?.rangeCount ?? 0); i++) {
    const r = selection?.getRangeAt(i)
    if (r) ranges.push(r.cloneRange())
  }
  const area = doc.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.setAttribute("aria-hidden", "true")
  area.tabIndex = -1
  applyVisuallyHidden(area)
  if (near?.parentNode) near.after(area)
  else doc.body.append(area)
  let ok = false
  try {
    area.focus({ preventScroll: true })
    area.select()
    ok = doc.execCommand("copy")
  } catch {
    ok = false
  } finally {
    area.remove()
    if (active && active !== doc.body && typeof active.focus === "function") {
      active.focus({ preventScroll: true })
    }
    if (selection) {
      selection.removeAllRanges()
      for (const r of ranges) selection.addRange(r)
    }
  }
  return ok
}

/** The browser clipboard of the document `documentOf` returns (nothing read until a copy). */
export function domClipboard(documentOf: () => Document | undefined): Clipboard {
  return {
    async writeText(text, options) {
      const doc = documentOf()
      if (!doc) throw new Error("No document to copy from")
      const native = api(doc)
      if (native) {
        try {
          await native.writeText(text)
          return
        } catch {
          // No permission, or an iframe without clipboard-write: the fallback may still work.
        }
      }
      if (!copyWithSelection(doc, text, options?.near)) throw new Error("Copy failed")
    },
  }
}
