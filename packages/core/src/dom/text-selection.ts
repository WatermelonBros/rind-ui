// Prevents text selection on a part while it is pressed. On iOS (quirk `ios-text-selection`)
// `user-select: none` on the element is not enough during a long touch, so the whole
// document's selection is disabled and restored 300 ms after the last press ends; a
// module-level state machine (default → disabled → restoring) keeps overlapping presses from
// racing, so the original value is restored exactly once.

import type { PlatformInfo, SchedulerEnv, TimerHandle } from "../env/capabilities"
import { quirkActive } from "./quirk-conditions"
import { registerReset } from "./resets"

const RESTORE_MS = 300

interface DocumentSelection {
  state: "default" | "disabled" | "restoring"
  presses: number
  original: string
  timer: TimerHandle | null
}
const documents = new Map<Document, DocumentSelection>()
registerReset(() => {
  for (const [doc, d] of documents) {
    const style = (doc.documentElement as Styled).style
    if (d.original) style?.setProperty("-webkit-user-select", d.original)
    else style?.removeProperty("-webkit-user-select")
  }
  documents.clear()
})

type Styled = Element & { style?: CSSStyleDeclaration }

/** Disables selection for one press; returns the function that ends it. */
export function textSelection(
  target: Element,
  env: PlatformInfo & SchedulerEnv,
  touch: boolean,
): () => void {
  if (touch && quirkActive("ios-text-selection", env)) {
    const root = target.ownerDocument.documentElement as Styled
    let d = documents.get(target.ownerDocument)
    if (!d) {
      d = { state: "default", presses: 0, original: "", timer: null }
      documents.set(target.ownerDocument, d)
    }
    const doc = d
    if (doc.state === "restoring" && doc.timer !== null) env.scheduler.clearTimeout(doc.timer)
    if (doc.state === "default") {
      doc.original = root.style?.getPropertyValue("-webkit-user-select") ?? ""
      root.style?.setProperty("-webkit-user-select", "none")
    }
    doc.state = "disabled"
    doc.presses++
    let ended = false
    return () => {
      if (ended) return
      ended = true
      if (--doc.presses > 0) return
      doc.state = "restoring"
      doc.timer = env.scheduler.setTimeout(() => {
        doc.timer = null
        if (doc.state !== "restoring") return
        if (doc.original) root.style?.setProperty("-webkit-user-select", doc.original)
        else root.style?.removeProperty("-webkit-user-select")
        doc.state = "default"
        documents.delete(target.ownerDocument)
      }, RESTORE_MS)
    }
  }
  const el = target as Styled
  const original = el.style?.userSelect ?? ""
  if (el.style) el.style.userSelect = "none"
  return () => {
    if (el.style) el.style.userSelect = original
  }
}
