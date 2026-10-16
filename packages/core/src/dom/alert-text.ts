// The text an Alert announces, read from its DOM (add-alert design §3), and the observer that
// reports when it changes, whatever re-rendered it.

const part = (root: Element, name: string) =>
  root.querySelector<HTMLElement>(
    `[data-scope="alert"][data-part="${name}"][data-instance="${root.getAttribute("data-instance") ?? ""}"]`,
  )

const skipped = (el: Element) =>
  el.getAttribute("aria-hidden") === "true" ||
  el.hasAttribute("hidden") ||
  (el.getAttribute("data-scope") === "alert" && el.getAttribute("data-part") === "close-trigger")

/** Text content minus `aria-hidden`, `hidden` and CloseTrigger subtrees; whitespace collapsed. */
function spokenText(el: Element): string {
  if (skipped(el)) return ""
  let out = ""
  for (const child of el.childNodes) {
    if (child.nodeType === 3) out += child.textContent ?? ""
    else if (child.nodeType === 1) out += ` ${spokenText(child as Element)} `
  }
  return out.replace(/\s+/g, " ").trim()
}

/**
 * The segments to announce: the labelled Icon's label, the Title and the Description, in that
 * order and non-empty; or the Root's own text when neither Title nor Description is rendered.
 * Visually hidden text is plain DOM text, so it is kept.
 */
export function announceableText(root: Element): string[] {
  const icon = part(root, "icon")
  const label = icon?.getAttribute("role") === "img" ? (icon.getAttribute("aria-label") ?? "") : ""
  const title = part(root, "title")
  const description = part(root, "description")
  const body =
    title || description
      ? [title ? spokenText(title) : "", description ? spokenText(description) : ""]
      : [spokenText(root)]
  return [label.trim(), ...body].filter(Boolean)
}

/**
 * Calls `onChange` with the new segments after each mutation batch that changes the joined
 * text. Returns the disconnect.
 */
export function observeText(root: Element, onChange: (segments: string[]) => void): () => void {
  let last = announceableText(root).join("\u0000")
  const observer = new MutationObserver(() => {
    const next = announceableText(root)
    const key = next.join("\u0000")
    if (key === last) return
    last = key
    onChange(next)
  })
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "aria-label", "role"],
  })
  return () => observer.disconnect()
}
