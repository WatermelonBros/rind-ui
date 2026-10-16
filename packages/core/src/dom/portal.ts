// Where portalled overlay content renders: the consumer's container; else the nearest open
// modal <dialog>, top-layer popover or fullscreen element holding the logical parent (so the
// content is not inert or hidden under it: native-platform.md §1, react-spectrum#10506);
// else the shadow root holding it (ark#2714); else its document's body. Layer behaviour
// never depends on where the content renders.

/** Copied from the logical parent's nearest ancestors onto the portal host, kept in sync. */
export const PORTAL_HOST_ATTRIBUTES = ["dir", "lang", "data-rind-theme", "data-theme"] as const

const isOpenTopLayer = (el: Element) =>
  (el instanceof HTMLDialogElement && el.open && el.matches(":modal")) ||
  (el.matches("[popover]") && el.matches(":popover-open"))

/** The element portalled content renders into. */
export function resolvePortalTarget(
  logicalParent: Element | null,
  container?: Element | ShadowRoot | null,
  doc: Document = logicalParent?.ownerDocument ?? document,
): Element | ShadowRoot {
  if (container) return container
  if (logicalParent) {
    for (let n: Element | null = logicalParent; n; n = n.parentElement) {
      try {
        if (isOpenTopLayer(n)) return n
      } catch {
        // `:modal` / `:popover-open` unsupported: no native top layer to join.
      }
    }
    const fullscreen = doc.fullscreenElement
    if (fullscreen?.contains(logicalParent)) return fullscreen
    const root = logicalParent.getRootNode()
    if (root instanceof ShadowRoot) return root
  }
  return doc.body
}

/** The host attributes the logical parent's ancestors give (dir, lang, theme, scheme). */
export function portalHostAttributes(logicalParent: Element | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of PORTAL_HOST_ATTRIBUTES) {
    const value = logicalParent?.closest(`[${name}]`)?.getAttribute(name)
    if (value !== undefined && value !== null) out[name] = value
  }
  return out
}

/**
 * Keeps `host`'s dir, lang, data-rind-theme and data-theme equal to the logical parent's
 * nearest ones (a scheme switch while open follows within the frame); returns the cleanup.
 */
export function syncPortalHost(
  host: Element,
  logicalParent: () => Element | null,
  /** `false`: applied once, not followed (a closed tooltip holds no observer). */
  observe = true,
): () => void {
  const apply = () => {
    const values = portalHostAttributes(logicalParent())
    for (const name of PORTAL_HOST_ATTRIBUTES) {
      const value = values[name]
      if (value === undefined) host.removeAttribute(name)
      else if (host.getAttribute(name) !== value) host.setAttribute(name, value)
    }
  }
  apply()
  const doc = host.ownerDocument
  const view = doc.defaultView
  if (!view || !observe) return () => {}
  // One observer per document for every host (two hundred closed tooltips: one observer).
  let shared = hostSyncs.get(doc)
  if (!shared) {
    const applies = new Set<() => void>()
    const observer = new view.MutationObserver(() => {
      for (const a of applies) a()
    })
    observer.observe(doc.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: [...PORTAL_HOST_ATTRIBUTES],
    })
    shared = { applies, observer }
    hostSyncs.set(doc, shared)
  }
  const own = shared
  own.applies.add(apply)
  return () => {
    own.applies.delete(apply)
    if (own.applies.size === 0) {
      own.observer.disconnect()
      hostSyncs.delete(doc)
    }
  }
}

const hostSyncs = new WeakMap<
  Document,
  { readonly applies: Set<() => void>; readonly observer: MutationObserver }
>()
