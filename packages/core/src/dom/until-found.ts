// Closed-but-mounted content findable by find-in-page and fragment navigation:
// `hidden="until-found"`, set imperatively after every render (neither the framework nor the
// browser's own removal on a match can leave it in another state). `beforematch` asks the
// machine to open (`reason: "find-in-page"`); if a controlled parent refuses, the attribute
// comes back a frame later. Where until-found is unsupported, plain `hidden`.
// React 19 serialises hidden="until-found" as hidden="": server HTML is plain hidden and this
// upgrades it after hydration, then opens the content if the URL's fragment points into it.
// Find-in-page before hydration cannot reach it (documented limitation).

import type { Scheduler } from "../env/capabilities"

export const supportsUntilFound = (el: HTMLElement) => "onbeforematch" in el

export interface UntilFoundOptions {
  readonly scheduler: Scheduler
  readonly isOpen: () => boolean
  /** Send the machine's open event with reason "find-in-page". */
  readonly onReveal: () => void
}

/**
 * Deep links: the browser looked for the fragment target before hydration, while the
 * content was plain `hidden`. If the target is inside closed content, open it (as a
 * find-in-page reveal) and scroll the target into view once it is shown.
 */
function revealFragmentTarget(el: HTMLElement, options: UntilFoundOptions) {
  if (options.isOpen()) return
  const doc = el.ownerDocument
  const hash = doc.defaultView?.location.hash.slice(1) ?? ""
  if (!hash) return
  let id = hash
  try {
    id = decodeURIComponent(hash)
  } catch {
    // A malformed escape: look the raw fragment up.
  }
  const target = doc.getElementById(id) ?? doc.getElementsByName(id)[0] ?? null
  if (!target || !el.contains(target)) return
  options.onReveal()
  options.scheduler.requestAnimationFrame(() => {
    if (options.isOpen()) target.scrollIntoView?.({ block: "start" })
  })
}

export function untilFound(el: HTMLElement, options: UntilFoundOptions) {
  const apply = () => {
    if (options.isOpen()) {
      el.removeAttribute("hidden")
      return
    }
    el.setAttribute("hidden", supportsUntilFound(el) ? "until-found" : "")
  }
  const onBeforeMatch = () => {
    options.onReveal()
    // A refused (controlled) open: hide it again once the parent had its chance.
    options.scheduler.requestAnimationFrame(apply)
  }
  el.addEventListener("beforematch", onBeforeMatch)
  apply()
  revealFragmentTarget(el, options)
  return {
    /** Call after every commit. */
    sync: apply,
    dispose: () => el.removeEventListener("beforematch", onBeforeMatch),
  }
}
