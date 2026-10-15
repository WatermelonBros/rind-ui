// content-size: the size custom properties a theme animates opening and closing content
// with (collapsible design §3). Shared by Collapsible, Accordion and Navigation Menu.
// Written imperatively after commit because they depend on layout; never `aria-*` or
// `data-*`, so connect's ownership rule holds. No measuring with animations disabled (the
// source of mount, first-open and Activity bugs elsewhere): 0px → px → auto → px → 0px.

export interface ContentSize {
  /** After the commit that opened the content. `instant`: initial render or find-in-page. */
  opened(options: { readonly instant: boolean }): void
  /** After the commit that closed it, before presence starts waiting. */
  closed(): void
  /** Another panel's content was committed into the same element (a shared viewport). */
  switched(): void
  /** Presence finished the enter animations: the size follows the content again. */
  settled(): void
  dispose(): void
}

type Axis = "height" | "width"

export function contentSize(el: HTMLElement, prefix: string): ContentSize {
  const win = (el.ownerDocument.defaultView ?? globalThis) as Window & typeof globalThis
  const prop = (axis: Axis) => `--${prefix}-content-${axis}`
  const write = (height: string, width: string) => {
    el.style.setProperty(prop("height"), height)
    el.style.setProperty(prop("width"), width)
  }
  /** The natural size, with the content's own alignment neutralised (flex and grid). */
  const measure = () => {
    const saved = ["justify-content", "align-content", "align-items", "justify-items"].map(
      (p) => [p, el.style.getPropertyValue(p)] as const,
    )
    for (const [p] of saved) el.style.setProperty(p, "normal")
    // The natural size is not bounded by the variable it is measured for.
    const height = el.style.getPropertyValue(prop("height"))
    const width = el.style.getPropertyValue(prop("width"))
    write("auto", "auto")
    const size = { height: el.scrollHeight, width: el.scrollWidth }
    write(height, width)
    for (const [p, v] of saved) {
      if (v) el.style.setProperty(p, v)
      else el.style.removeProperty(p)
    }
    return size
  }
  /** The size rendered now (px, or the computed size when the variable is `auto`). */
  const rendered = () => {
    const r = el.getBoundingClientRect()
    return { height: r.height, width: r.width }
  }
  // A style flush between two writes makes the second one a transition from the first.
  const flush = () => void win.getComputedStyle(el).height
  let settling = false
  // Defined from the first render (never inherited from an outer content: radix#3037).
  if (!el.style.getPropertyValue(prop("height"))) write("0px", "0px")
  return {
    opened({ instant }) {
      if (instant) {
        // Initial render or find-in-page: straight to auto, no animation (base-ui#5513).
        settling = false
        return write("auto", "auto")
      }
      write("0px", "0px")
      const size = measure()
      flush()
      settling = true
      write(`${size.height}px`, `${size.width}px`)
    },
    closed() {
      settling = false
      // From auto: the current size as px (nothing animates), then 0px after a flush.
      const size = el.style.getPropertyValue(prop("height")) === "auto" ? measure() : rendered()
      write(`${size.height}px`, `${size.width}px`)
      flush()
      write("0px", "0px")
    },
    switched() {
      // From the size rendered now (a second switch mid-animation starts where it is).
      const from = rendered()
      write(`${from.height}px`, `${from.width}px`)
      const size = measure()
      flush()
      settling = true
      write(`${size.height}px`, `${size.width}px`)
    },
    settled() {
      if (!settling) return
      settling = false
      // At rest the size follows the content (base-ui#1458, WCAG 1.4.12).
      write("auto", "auto")
    },
    dispose() {
      settling = false
    },
  }
}
