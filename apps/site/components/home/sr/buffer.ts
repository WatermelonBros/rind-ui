// The page as a screen reader's browse mode sees it: a flat list of things to read, in document
// order, each with the containers (landmarks, lists, groups) it sits in. Built from the real
// accessibility semantics: roles from dom-accessibility-api's getRole, names and descriptions
// from its accname implementation (the same one rind's test drivers use).
import { computeAccessibleDescription, computeAccessibleName, getRole } from "dom-accessibility-api"

export type Container = {
  readonly el: Element
  /** landmark | region | list | group | radiogroup | tablist | dialog */
  readonly kind: string
  readonly name: string
  /** a list's item count */
  readonly count?: number
}

export type Item = {
  readonly el: HTMLElement
  /** the ARIA role ("text" for plain text) */
  readonly role: string
  readonly name: string
  readonly description: string
  readonly path: readonly Container[]
}

const LANDMARKS: Record<string, string> = {
  banner: "banner",
  navigation: "navigation",
  main: "main",
  contentinfo: "content info",
  complementary: "complementary",
  search: "search",
}
/** Roles read as one item: their text is their name, browse mode does not go inside them. */
const LEAVES = new Set([
  "link",
  "button",
  "switch",
  "checkbox",
  "radio",
  "tab",
  "slider",
  "textbox",
  "searchbox",
  "combobox",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "spinbutton",
  "heading",
  "img",
  "progressbar",
  "meter",
])
const GROUPS = new Set(["group", "radiogroup", "tablist", "dialog", "alertdialog", "toolbar"])

function hidden(el: Element): boolean {
  if (el.getAttribute("aria-hidden") === "true" || el.hasAttribute("hidden")) return true
  if (el instanceof HTMLElement && el.inert) return true
  const s = getComputedStyle(el)
  return s.display === "none" || s.visibility === "hidden"
}

function isBlock(el: Element): boolean {
  const d = getComputedStyle(el).display
  return !d.startsWith("inline") && d !== "contents"
}

/** Walks `root` (skipping `skip`, the simulator's own UI) into browse-mode items. */
export function buildBuffer(root: Element, skip: (el: Element) => boolean): Item[] {
  const items: Item[] = []
  let text = ""
  let textEl: HTMLElement | null = null
  let textPath: readonly Container[] = []
  const flush = () => {
    const t = text.replace(/\s+/g, " ").trim()
    if (t && textEl) {
      items.push({ el: textEl, role: "text", name: t, description: "", path: textPath })
    }
    text = ""
    textEl = null
  }
  const walk = (node: Node, path: readonly Container[], block: HTMLElement) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? ""
      if (t.trim()) {
        if (!textEl) {
          textEl = block
          textPath = path
        }
        text += t
      }
      return
    }
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return
    const el = node
    if (skip(el) || hidden(el)) return
    if (el instanceof SVGElement && !el.getAttribute("role") && !el.getAttribute("aria-label"))
      return
    const role = getRole(el) ?? ""
    const html = el instanceof HTMLElement ? el : null
    if (html && LEAVES.has(role)) {
      if (role === "img" && !computeAccessibleName(el)) return
      flush()
      items.push({
        el: html,
        role,
        name: computeAccessibleName(el).trim(),
        description: computeAccessibleDescription(el).trim(),
        path,
      })
      return
    }
    let next = path
    const name = computeAccessibleName(el).trim()
    const landmark = LANDMARKS[role] ?? (role === "region" && name ? "region" : undefined)
    if (landmark) next = [...path, { el, kind: landmark, name: role === "region" ? name : "" }]
    else if (role === "list") {
      const count = el.querySelectorAll(":scope > li, :scope > [role='listitem']").length
      next = [...path, { el, kind: "list", name: "", count }]
    } else if (GROUPS.has(role) && (name || role !== "group"))
      next = [...path, { el, kind: role, name }]
    const blockEl = html && isBlock(el) ? html : block
    if (blockEl !== block || next !== path) flush()
    for (const child of el.childNodes) walk(child, next, blockEl)
    if (blockEl !== block || next !== path) flush()
  }
  walk(root, [], root as HTMLElement)
  flush()
  return items
}

/** The item for an element (the element itself, or the item that contains it). */
export function itemIndexOf(items: readonly Item[], el: Element): number {
  const exact = items.findIndex((i) => i.el === el)
  if (exact >= 0) return exact
  return items.findIndex((i) => i.el.contains(el))
}

/** One element as an item of its own (no containers): for a single announcement. */
export function itemFor(el: HTMLElement): Item {
  const role = getRole(el) ?? (el.textContent?.trim() ? "text" : "")
  return {
    el,
    role,
    name: computeAccessibleName(el).trim() || (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    description: computeAccessibleDescription(el).trim(),
    path: [],
  }
}
