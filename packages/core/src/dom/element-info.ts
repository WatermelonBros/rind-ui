// What a part's rendered element is, read from the element itself (button-like-element
// "Element Substitution Keeps Behaviour"): connect adapts its attributes to it.

export interface ElementInfo {
  /** Lowercase tag name. */
  readonly tag: string
  /** The explicit `role` attribute, if any. */
  readonly role: string | null
  /** Whether it is a link: `a[href]` or `area[href]`. */
  readonly link: boolean
  /** Whether a `<label>` can label it (and forward clicks to it). */
  readonly labelable: boolean
}

const LABELABLE = new Set(["button", "input", "meter", "output", "progress", "select", "textarea"])

export function elementInfo(el: Element): ElementInfo {
  const tag = el.tagName.toLowerCase()
  return {
    tag,
    role: el.getAttribute("role"),
    link: (tag === "a" || tag === "area") && el.hasAttribute("href"),
    labelable: LABELABLE.has(tag),
  }
}
