// What the generic invariants read from the page after each step. Runs in the page:
// imported directly by the DOM adapter, and injected into Playwright pages as part of the
// `inpage` bundle, so both adapters compute names and visibility identically.

import { isKeptVisible } from "@rind-ui/core"
import { computeAccessibleDescription, computeAccessibleName } from "dom-accessibility-api"

export interface ElementInfo {
  /** `button#id[data-part=trigger]` — for failure messages. */
  readonly describe: string
  /** The rind-ui part this element is, if any. */
  readonly part: string | null
  readonly role: string | null
  readonly name: string
  readonly description: string
  /** Whitespace-normalised textContent. */
  readonly text: string
  readonly id: string | null
  readonly attrs: Readonly<Record<string, string>>
  /** Not visible: see `isVisible`. */
  readonly hidden: boolean
  readonly inAriaHidden: boolean
  readonly inInert: boolean
  readonly focusable: boolean
  /** Finite animations running on the element (exit animations a presence waits for). */
  readonly animations: number
  /** The element's identity across snapshots of one page (same node, same number). */
  readonly node: number
  /** Its border box in viewport coordinates (all zero without layout). */
  readonly rect: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  /** Items of one set share it (parent element and aria-level), for set metadata. */
  readonly group: string
  /** Ids of its ancestors, nearest first. */
  readonly within: readonly string[]
}

export interface FormInputInfo {
  readonly describe: string
  readonly checked: boolean
  readonly indeterminate: boolean
  readonly value: string
  readonly ariaHidden: string | null
  readonly tabIndex: number
  readonly focused: boolean
  /** `change` / `input` / `click` events whose target was this input. */
  readonly changes: number
  readonly inputs: number
  readonly clicks: number
  /** Inside a group's select-all Parent (`data-parent`): submits nothing. */
  readonly inParent: boolean
}

export interface IdRef {
  readonly from: string
  readonly attr: string
  readonly id: string
  readonly exists: boolean
  readonly targetInInert: boolean
}

export interface DomSnapshot {
  /** Part elements of the instance, anywhere in the document, in document order. */
  readonly parts: readonly ElementInfo[]
  /** Parts and every element inside them. */
  readonly elements: readonly ElementInfo[]
  readonly refs: readonly IdRef[]
  /** Ids rendered by the instance that appear more than once in the document. */
  readonly duplicateIds: readonly string[]
  readonly focus: {
    readonly onBody: boolean
    readonly part: string | null
    readonly inInstance: boolean
    readonly element: ElementInfo | null
  }
  readonly html: Readonly<Record<string, string>>
  readonly body: Readonly<Record<string, string>>
  /** aria-hidden, inert and style of the siblings of every part's ancestors, by identity. */
  readonly outside: Readonly<Record<string, Readonly<Record<string, string>>>>
  /**
   * The rind-ui Field around the instance (field-associated trait): its root's attributes,
   * its Label, and the ids of its rendered Description and ErrorMessage parts.
   */
  readonly field: {
    readonly attrs: Readonly<Record<string, string>>
    readonly label: {
      readonly id: string
      readonly text: string
      readonly for: string | null
    } | null
    readonly partIds: readonly string[]
  } | null
  /** Live regions (explicit `aria-live` other than "off", or by role) inside the parts. */
  readonly liveRegions: readonly string[]
  /**
   * The instance's hidden form inputs (`data-part="hidden-input"`, form-associated trait):
   * DOM properties (never attributes) and the events each dispatched since the page's first
   * snapshot.
   */
  readonly formInputs: readonly FormInputInfo[]
  /** The visual viewport, and whether the page has real layout (not jsdom). */
  readonly viewport: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly layout: boolean
  }
}

const LIVE_ROLES = ["status", "alert", "log", "marquee", "timer"]
const REF_ATTRS = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-activedescendant",
  "aria-owns",
  "aria-details",
  "for",
]

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

/**
 * The one visibility rule both adapters use: attached, and neither it nor an ancestor is
 * `hidden` (including `until-found`), `inert` or `display: none`, and it is not
 * `visibility: hidden`. `display: contents` counts as visible: its children render.
 */
export function isVisible(el: Element): boolean {
  if (!el.isConnected) return false
  const view = el.ownerDocument.defaultView
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute("hidden") || n.hasAttribute("inert")) return false
    const style = view?.getComputedStyle(n)
    if (style?.display === "none") return false
    if (n === el && style?.visibility === "hidden") return false
  }
  return true
}

function implicitRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase()
  const type = el.getAttribute("type")
  switch (tag) {
    case "button":
      return "button"
    case "a":
      return el.hasAttribute("href") ? "link" : null
    case "input":
      if (type === "checkbox") return "checkbox"
      if (type === "radio") return "radio"
      if (type === "range") return "slider"
      if (type === "number") return "spinbutton"
      if (type === "button" || type === "submit" || type === "reset" || type === "image") {
        return "button"
      }
      if (type === "hidden") return null
      return "textbox"
    case "textarea":
      return "textbox"
    case "select":
      return el.hasAttribute("multiple") ? "listbox" : "combobox"
    case "img":
      return el.getAttribute("alt") === "" ? "presentation" : "img"
    case "dialog":
      return "dialog"
    case "ul":
    case "ol":
      return "list"
    case "li":
      return "listitem"
    case "nav":
      return "navigation"
    case "main":
      return "main"
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading"
    default:
      return null
  }
}
const roleOf = (el: Element) => el.getAttribute("role")?.split(" ")[0] || implicitRole(el)

function focusable(el: Element): boolean {
  if (!("tabIndex" in el) || (el as HTMLButtonElement).disabled) return false
  if (el.hasAttribute("tabindex")) return true
  return el.matches(
    "a[href], button, input:not([type=hidden]), select, textarea, [contenteditable=''], [contenteditable=true]",
  )
}

const describe = (el: Element) => {
  const part = el.getAttribute("data-part")
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${part ? `[data-part=${part}]` : ""}`
}
const attrsOf = (el: Element) => {
  const out: Record<string, string> = {}
  for (const a of Array.from(el.attributes)) out[a.name] = a.value
  return out
}
const ancestorIds = (el: Element) => {
  const out: string[] = []
  for (let n = el.parentElement; n; n = n.parentElement) if (n.id) out.push(n.id)
  return out
}
// Stable per element for the life of the page (both adapters run this module once per
// document), so snapshots taken at different steps key the same element the same way.
const identities = new WeakMap<Element, number>()
let lastIdentity = 0
const identity = (el: Element) => {
  let id = identities.get(el)
  if (id === undefined) {
    lastIdentity += 1
    id = lastIdentity
    identities.set(el, id)
  }
  return id
}
const isLive = (el: Element) => {
  const live = el.getAttribute("aria-live")
  return live !== null ? live !== "off" : LIVE_ROLES.includes(roleOf(el) ?? "")
}

// Page-wide counters of the events hidden form inputs dispatch, installed by the first
// snapshot (capture, so a consumer's stopPropagation cannot hide one).
const formEvents = new WeakMap<Element, { change: number; input: number; click: number }>()
let countingFormEvents = false
function countFormEvents() {
  if (countingFormEvents) return
  countingFormEvents = true
  for (const type of ["change", "input", "click"] as const) {
    document.addEventListener(
      type,
      (e) => {
        const t = e.target
        if (!(t instanceof Element) || t.getAttribute("data-part") !== "hidden-input") return
        const c = formEvents.get(t) ?? { change: 0, input: 0, click: 0 }
        c[type] += 1
        formEvents.set(t, c)
      },
      true,
    )
  }
}

export function collectDom(arg: {
  readonly scope: string
  readonly instance: string
}): DomSnapshot {
  const doc = document
  countFormEvents()
  const parents = new Map<Element | null, number>()
  const groupOf = (el: Element) => {
    const parent = el.parentElement
    if (!parents.has(parent)) parents.set(parent, parents.size)
    return `${parents.get(parent)}|${el.getAttribute("aria-level") ?? ""}`
  }
  const own = (el: Element) =>
    el.getAttribute("data-instance") === arg.instance && el.getAttribute("data-scope") === arg.scope
  const info = (el: Element): ElementInfo => ({
    describe: describe(el),
    node: identity(el),
    rect: (() => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })(),
    part: own(el) ? el.getAttribute("data-part") : null,
    role: roleOf(el),
    name: norm(computeAccessibleName(el)),
    description: norm(computeAccessibleDescription(el)),
    text: norm(el.textContent),
    id: el.id || null,
    attrs: attrsOf(el),
    hidden: !isVisible(el),
    inAriaHidden: el.closest("[aria-hidden=true]") !== null,
    inInert: el.closest("[inert]") !== null,
    focusable: focusable(el),
    animations:
      typeof el.getAnimations === "function"
        ? el
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY,
            ).length
        : 0,
    group: groupOf(el),
    within: ancestorIds(el),
  })

  const selector = `[data-scope="${CSS.escape(arg.scope)}"][data-instance="${CSS.escape(arg.instance)}"]`
  const partEls = Array.from(doc.querySelectorAll(`${selector}[data-part]`))
  const all = new Set<Element>()
  for (const p of partEls) {
    all.add(p)
    for (const d of Array.from(p.querySelectorAll("*"))) all.add(d)
  }
  const elements = Array.from(all)

  const refs: IdRef[] = []
  const ids = new Set<string>()
  for (const el of elements) {
    if (el.id) ids.add(el.id)
    for (const attr of REF_ATTRS) {
      for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
        const target = doc.getElementById(id)
        refs.push({
          from: describe(el),
          attr,
          id,
          exists: target !== null,
          targetInInert: target?.closest("[inert]") != null,
        })
      }
    }
  }
  const duplicateIds = Array.from(ids).filter(
    (id) => doc.querySelectorAll(`[id="${CSS.escape(id)}"]`).length > 1,
  )

  // Siblings of every ancestor of every part (where hide-others libraries put aria-hidden
  // or inert), keyed by element identity so inserted nodes do not shift the keys.
  const outside: Record<string, Record<string, string>> = {}
  const record = (sibling: Element) => {
    const picked: Record<string, string> = {}
    for (const name of ["aria-hidden", "inert", "style"]) {
      const v = sibling.getAttribute(name)
      if (v !== null) picked[name] = v
    }
    // The one keep-visible rule (announcer, top layers, live regions): stays exposed.
    if (isKeptVisible(sibling)) picked["data-rind-kept"] = ""
    if (["SCRIPT", "STYLE", "TEMPLATE", "LINK"].includes(sibling.tagName)) {
      picked["data-rind-kept"] = ""
    }
    outside[`${identity(sibling)}:${describe(sibling)}`] = picked
  }
  const holdsInstance = (el: Element) => all.has(el) || el.querySelector(selector) !== null
  for (const p of partEls) {
    for (let n: Element | null = p; n && n !== doc.body && n.parentElement; n = n.parentElement) {
      for (const sibling of Array.from(n.parentElement.children)) {
        if (sibling !== n && !holdsInstance(sibling)) record(sibling)
      }
    }
  }
  // The component is gone (unmounted while open): every element left in the page, so the
  // ones the baseline recorded are compared (a stuck inert on the app root is caught).
  if (partEls.length === 0 && doc.body) {
    for (const el of Array.from(doc.body.querySelectorAll("*"))) record(el)
  }

  const active = doc.activeElement
  const activePart = active?.closest(selector)
  const fieldRoot = partEls[0]?.closest('[data-scope="field"][data-part="root"]') ?? null
  const fieldPart = (part: string) =>
    fieldRoot
      ? Array.from(
          doc.querySelectorAll(
            `[data-scope="field"][data-part="${part}"][data-instance="${fieldRoot.getAttribute("data-instance")}"]`,
          ),
        )
      : []
  const fieldLabel = fieldPart("label")[0]
  const field = fieldRoot
    ? {
        attrs: attrsOf(fieldRoot),
        label: fieldLabel
          ? {
              id: fieldLabel.id,
              text: norm(fieldLabel.textContent),
              for: fieldLabel.getAttribute("for"),
            }
          : null,
        partIds: [...fieldPart("description"), ...fieldPart("error-message")]
          .map((e) => e.id)
          .filter(Boolean),
      }
    : null
  return {
    field,
    parts: partEls.map(info),
    elements: elements.map(info),
    refs,
    duplicateIds,
    focus: {
      onBody: active === null || active === doc.body,
      part: activePart?.getAttribute("data-part") ?? null,
      inInstance: activePart != null,
      element: active && active !== doc.body ? info(active) : null,
    },
    html: attrsOf(doc.documentElement),
    body: attrsOf(doc.body),
    outside,
    viewport: (() => {
      const view = doc.defaultView
      const vv = view?.visualViewport
      return {
        x: vv?.offsetLeft ?? 0,
        y: vv?.offsetTop ?? 0,
        width: vv?.width ?? view?.innerWidth ?? 0,
        height: vv?.height ?? view?.innerHeight ?? 0,
        layout: !navigator.userAgent.includes("jsdom") && (view?.innerWidth ?? 0) > 0,
      }
    })(),
    liveRegions: elements.filter(isLive).map(describe),
    // The instance's own input, or a group's item inputs (inside its parts).
    formInputs: elements
      .filter((el) => el.getAttribute("data-part") === "hidden-input")
      .map((el) => {
        const input = el as HTMLInputElement
        const c = formEvents.get(el) ?? { change: 0, input: 0, click: 0 }
        return {
          describe: describe(el),
          checked: input.checked === true,
          indeterminate: input.indeterminate === true,
          value: input.value ?? "",
          ariaHidden: el.getAttribute("aria-hidden"),
          tabIndex: input.tabIndex,
          focused: doc.activeElement === el,
          changes: c.change,
          inputs: c.input,
          clicks: c.click,
          inParent: el.closest("[data-parent]") !== null,
        }
      }),
  }
}
