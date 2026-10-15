// The control a label names: its `control` (for / wrapping), else the element whose
// `aria-labelledby` lists the label's id (a non-labelable target). Self-contained: the
// in-page module bundles it for the Playwright adapter.

export function labelledControl(label: Element): Element | null {
  const control = (label as HTMLLabelElement).control
  if (control) return control
  const root = label.getRootNode() as Document | ShadowRoot
  if (label.id) {
    for (const el of Array.from(root.querySelectorAll("[aria-labelledby]"))) {
      if (el.getAttribute("aria-labelledby")?.split(/\s+/).includes(label.id)) return el
    }
  }
  const htmlFor = label.getAttribute("for")
  return htmlFor && "getElementById" in root ? root.getElementById(htmlFor) : null
}
