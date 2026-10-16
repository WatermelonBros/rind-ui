// Badge's post-mount development check (add-badge design §2): an exposed badge with nothing
// to say, and a badge whose count its interactive host hides behind an `aria-label`. A
// heuristic over attributes (substring of the host's label text), not an accname
// computation: the precise check is the browser test suite's (decision 0008).

import { accessibleNameOf } from "./accname"

declare const process: { env: { NODE_ENV?: string } }

/** Hosts whose name a badge's text should reach (the spec's role list). */
const HOST = [
  "button",
  "a[href]",
  ...[
    "button",
    "link",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "treeitem",
    "switch",
    "checkbox",
  ].map((r) => `[role="${r}"]`),
].join(",")

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()

const describe = (el: Element) => {
  const name = el.getAttribute("aria-label") ?? el.getAttribute("aria-labelledby")
  return `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}> named ${JSON.stringify(name)}`
}

/** The development warnings for a mounted badge; `label`: its `label` prop. */
export function checkBadgeHost(root: Element, label: string | undefined): void {
  if (process.env.NODE_ENV === "production") return
  if (root.closest('[aria-hidden="true"]')) return
  const spoken = norm(label ?? root.textContent ?? "")
  if (spoken === "") {
    console.warn(
      '[rind-ui] badge: an exposed badge has no text; pass label="…" or aria-hidden="true"',
    )
    return
  }
  const host = root.parentElement?.closest(HOST)
  if (!host || !(host.hasAttribute("aria-label") || host.hasAttribute("aria-labelledby"))) return
  if (norm(accessibleNameOf(host)).includes(spoken)) return
  const described = (host.getAttribute("aria-describedby") ?? "").split(/\s+/)
  if (root.id && described.includes(root.id)) return
  console.warn(
    `[rind-ui] badge: the badge text ${JSON.stringify(spoken)} is not in the accessible name or description of its host ${describe(host)}; drop the host's aria-label (name from content) or add the badge id to its aria-describedby`,
  )
}
