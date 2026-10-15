// Generic invariants checked after every step of `testMachine`, with no per-component
// code. Rule numbers refer to the checklist in docs/research/accessibility.md. Each check
// is a pure function of DOM snapshots, so it runs the same in jsdom, browsers and
// Playwright, and can be tested on hand-written DOM.

import {
  type Announcement,
  type GenericInvariantId,
  type Modality,
  type PlatformFlags,
  quirkActive,
  type Trait,
} from "@rind-ui/core"
import type { DomSnapshot, ElementInfo } from "./collect"

export interface StepFacts {
  /** The DOM before the step (null for the initial check). */
  readonly before: DomSnapshot | null
  readonly after: DomSnapshot
  /** The DOM when the path started, for "restored after close" checks. */
  readonly baseline: DomSnapshot
  /** Oracle state before and after the step. */
  readonly from: string | null
  readonly state: string
  /** What the contract expects of one part element in this state (data-state, ARIA attrs). */
  readonly expected: (el: ElementInfo) => PartExpected
  /** Whether the instance is open in this state (per the contract's data-state). */
  readonly open: boolean
  /** True when the oracle state is the machine's initial state. */
  readonly atInitial: boolean
  readonly anchorCount: number
  readonly errors: readonly string[]
  readonly traits: readonly Trait[]
  readonly semantics: Readonly<Record<string, string | undefined>>
  /** Resolved controllable values of the oracle (`value` for `valued` and `selectable`). */
  readonly values: Readonly<Record<string, unknown>>
  /** The oracle's context after the step (`highlightedKey` for collection checks). */
  readonly context?: Readonly<Record<string, unknown>>
  /** Item count of the oracle's collection prop, when it has one (set metadata). */
  readonly collectionSize?: number | undefined
  /** The modality the step ran in (null for the initial check, delays and prop steps). */
  readonly modality?: Modality | null
  /** The platform the run emulates. */
  readonly platform?: PlatformFlags
  /** Announcements made during the step. */
  readonly stepAnnouncements?: readonly Announcement[]
  /** The contract's queries, observed after the step. */
  readonly observed?: Readonly<Record<string, unknown>>
  /** The contract's declared announcements (composite-activedescendant). */
  readonly announcements?: {
    readonly focusAnnouncement: (observed: never) => string
    readonly countAnnouncement: (observed: never) => string
    readonly selectionAnnouncement: (observed: never) => string
    readonly sectionAnnouncement?: (observed: never) => string
  }
  /** True when a contract exception (through an active quirk) exempts `part` from `invariant`. */
  readonly exempt?: (invariant: GenericInvariantId, part: string) => boolean
}

export interface PartExpected {
  readonly dataState?: string | undefined
  /** Attribute values; null means the attribute must be absent. */
  readonly attrs?: Readonly<Record<string, string | null>> | undefined
}

export type GenericInvariant = (facts: StepFacts) => readonly string[]

const NAME_REQUIRED = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "treeitem",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "slider",
  "spinbutton",
  "dialog",
  "alertdialog",
  "img",
  "progressbar",
  "meter",
  "tree",
  "grid",
  "treegrid",
  "region",
  "form",
])

const exposed = (el: ElementInfo) => !el.hidden && !el.inAriaHidden && !el.inInert
const isTrue = (v: string | undefined) => v === "true"
const items = (s: DomSnapshot) => s.elements.filter((el) => el.part === "item")
const ids = (v: string | undefined) => (v ?? "").split(/\s+/).filter(Boolean)
const isOpen = (f: StepFacts) => f.open

/** At most one item is data-highlighted, and it is the oracle's highlighted key. */
function highlightChecks(f: StepFacts): string[] {
  const lit = items(f.after).filter((el) => el.attrs["data-highlighted"] !== undefined)
  const out =
    lit.length > 1
      ? [`${lit.length} items are data-highlighted: ${lit.map((el) => el.describe).join(", ")}`]
      : []
  const want = f.context?.["highlightedKey"]
  if (want !== undefined && lit.length <= 1) {
    const have = lit[0]?.attrs["data-key"] ?? null
    if (have !== want) {
      out.push(
        `the highlighted item is ${have === null ? "none" : `"${have}"`}, the machine's is ${want === null ? "none" : `"${String(want)}"`}`,
      )
    }
  }
  return out
}

const anchor: GenericInvariant = (f) =>
  f.anchorCount === 1 ? [] : [`exactly one element must match the anchor; found ${f.anchorCount}`]

const noErrors: GenericInvariant = (f) => f.errors.map((e) => `error during the step: ${e}`)

/** Every part (items included) carries the data-state the contract declares for it. */
const dataState: GenericInvariant = (f) => {
  const out: string[] = []
  for (const p of f.after.parts) {
    const want = f.expected(p).dataState
    if (want === undefined) continue
    const have = p.attrs["data-state"]
    if (have === undefined) out.push(`${p.describe} has no data-state, expected "${want}"`)
    else if (have !== want) out.push(`${p.describe} has data-state="${have}", expected "${want}"`)
  }
  return out
}

/** (6) ARIA state attributes equal what the machine's state implies (contract `attrs`). */
const machineAttrs: GenericInvariant = (f) => {
  const out: string[] = []
  for (const p of f.after.parts) {
    for (const [name, want] of Object.entries(f.expected(p).attrs ?? {})) {
      const have = p.attrs[name] ?? null
      if (have !== want) {
        out.push(
          `${p.describe} ${name}=${JSON.stringify(have)}, expected ${JSON.stringify(want)} in ${f.state}`,
        )
      }
    }
  }
  return out
}

/** (1) Every element whose role requires a name has one. */
const names: GenericInvariant = (f) =>
  f.after.elements
    .filter((el) => exposed(el) && el.role && NAME_REQUIRED.has(el.role) && el.name === "")
    .map((el) => `${el.describe} (role ${el.role}) has no accessible name`)

/** (5) What a visible label/title part labels has the label's text in its name. */
const labelText: GenericInvariant = (f) => {
  const labelPart = f.semantics["label"]
  const label = f.after.parts.find((p) => p.part === labelPart && exposed(p))
  if (!label?.id || label.text === "") return []
  const id = label.id
  const labelled = f.after.elements.filter(
    (el) => ids(el.attrs["aria-labelledby"]).includes(id) || label.attrs["for"] === el.id,
  )
  return labelled
    .filter((el) => !el.name.includes(label.text))
    .map(
      (el) =>
        `${el.describe}'s accessible name "${el.name}" does not contain its label "${label.text}"`,
    )
}

/** (2) Every IDREF resolves; (3) every rendered id is unique. */
const refs: GenericInvariant = (f) => [
  ...f.after.refs
    .filter((r) => !r.exists)
    .map((r) => `${r.from} ${r.attr}="${r.id}": no element has id "${r.id}"`),
  ...f.after.duplicateIds.map((id) => `id "${id}" is not unique in the document`),
]

/** Name sources stay reachable: labelledby/describedby targets are not inert. */
const nameSourcesNotInert: GenericInvariant = (f) =>
  f.after.refs
    .filter(
      (r) => (r.attr === "aria-labelledby" || r.attr === "aria-describedby") && r.targetInInert,
    )
    .map((r) => `${r.from} ${r.attr} points at "${r.id}", which is inside an inert subtree`)

const CHECKED: Readonly<Record<string, string>> = {
  true: "checked",
  false: "unchecked",
  mixed: "indeterminate",
}

/** (6) State attributes agree with their data-* counterparts. */
const stateAttrs: GenericInvariant = (f) => {
  const out: string[] = []
  const pairs: [string, string][] = [
    ["aria-disabled", "data-disabled"],
    ["aria-invalid", "data-invalid"],
    ["aria-selected", "data-selected"],
  ]
  for (const el of f.after.elements) {
    for (const [aria, data] of pairs) {
      if (el.attrs[aria] === undefined && el.attrs[data] === undefined) continue
      if (isTrue(el.attrs[aria]) !== (el.attrs[data] !== undefined)) {
        out.push(`${el.describe}: ${aria}="${el.attrs[aria] ?? ""}" disagrees with ${data}`)
      }
    }
    const ds = el.attrs["data-state"]
    const expanded = el.attrs["aria-expanded"]
    if (
      expanded !== undefined &&
      (ds === "open" || ds === "closed") &&
      isTrue(expanded) !== (ds === "open")
    ) {
      out.push(`${el.describe}: aria-expanded="${expanded}" disagrees with data-state="${ds}"`)
    }
    // data-pressed is "a press is in progress" (press-interactions); a toggle's state is
    // data-state on/off.
    const pressedAttr = el.attrs["aria-pressed"]
    if (
      pressedAttr !== undefined &&
      (ds === "on" || ds === "off") &&
      isTrue(pressedAttr) !== (ds === "on")
    ) {
      out.push(`${el.describe}: aria-pressed="${pressedAttr}" disagrees with data-state="${ds}"`)
    }
    const checked = el.attrs["aria-checked"]
    if (
      checked !== undefined &&
      ds !== undefined &&
      Object.values(CHECKED).includes(ds) &&
      CHECKED[checked] !== ds
    ) {
      out.push(`${el.describe}: aria-checked="${checked}" disagrees with data-state="${ds}"`)
    }
  }
  return out
}

/** (10) Focus is never inside aria-hidden or inert; nothing focusable is aria-hidden. */
const hiddenFocus: GenericInvariant = (f) => {
  const out: string[] = []
  const focused = f.after.focus.element
  if (focused?.inAriaHidden) out.push(`focus is on ${focused.describe}, inside aria-hidden`)
  if (focused?.inInert) out.push(`focus is on ${focused.describe}, inside inert`)
  for (const el of f.after.elements) {
    if (el.focusable && el.inAriaHidden && !el.hidden) {
      out.push(`${el.describe} is focusable inside aria-hidden`)
    }
  }
  return out
}

/**
 * (11) Focus that was inside the component stays inside it — never on body. Moving to
 * another element is leaving (Tab out) when the machine took a transition to another state
 * (focused → idle); without one, the component lost focus.
 */
const focusKept: GenericInvariant = (f) =>
  f.before?.focus.inInstance &&
  !f.after.focus.inInstance &&
  (f.after.focus.onBody || f.from === null || f.from === f.state)
    ? [
        `focus left the component (now ${f.after.focus.onBody ? "<body>" : f.after.focus.element?.describe})`,
      ]
    : []

/** (23) No live region of its own unless the contract declares `live-region`. */
const liveRegions: GenericInvariant = (f) =>
  f.traits.includes("live-region")
    ? []
    : f.after.liveRegions.map((r) => `${r} is a live region; announce through the Announcer`)

/**
 * html/body never hidden; what the component added outside its parts (html, body and
 * body's other children) is gone once it is back in its initial state.
 */
const documentClean: GenericInvariant = (f) => {
  const out: string[] = []
  for (const [tag, attrs] of [
    ["html", f.after.html],
    ["body", f.after.body],
  ] as const) {
    if (attrs["aria-hidden"] !== undefined) out.push(`<${tag}> has aria-hidden`)
    if (attrs["inert"] !== undefined) out.push(`<${tag}> is inert`)
  }
  if (!f.atInitial) return out
  // What hiding, inert-ing and scroll locking touch; other attributes belong to the app.
  const compare = (where: string, now: Record<string, string>, then: Record<string, string>) => {
    for (const key of ["aria-hidden", "inert", "data-rind-scroll-locked"]) {
      // Absent and empty differ: `inert=""` is set.
      if ((now[key] ?? null) !== (then[key] ?? null)) {
        out.push(`${where} ${key}="${now[key] ?? ""}" was not restored to "${then[key] ?? ""}"`)
      }
    }
    // Styles per property, naming it (an empty style attribute equals none: jsdom keeps it).
    const declarations = (css: string | undefined) =>
      new Map(
        (css ?? "")
          .split(";")
          .map((d) => d.split(":").map((x) => x.trim()) as [string, string?])
          .filter(([k]) => k !== "")
          .map(([k, v]) => [k, v ?? ""]),
      )
    const nowStyle = declarations(now["style"])
    const thenStyle = declarations(then["style"])
    for (const prop of new Set([...nowStyle.keys(), ...thenStyle.keys()])) {
      if (nowStyle.get(prop) !== thenStyle.get(prop)) {
        out.push(
          `${where} style ${prop}: "${nowStyle.get(prop) ?? ""}" was not restored to "${thenStyle.get(prop) ?? ""}"`,
        )
      }
    }
  }
  compare("<html>", f.after.html, f.baseline.html)
  compare("<body>", f.after.body, f.baseline.body)
  // Only elements that existed when the path started: new ones are not ours to judge.
  for (const [child, then] of Object.entries(f.baseline.outside)) {
    const now = f.after.outside[child]
    if (now) compare(child, now, then)
  }
  return out
}

/** Name and description are never identical (no double reading). */
const nameNotDescription: GenericInvariant = (f) =>
  f.after.elements
    .filter((el) => exposed(el) && el.name !== "" && el.name === el.description)
    .map((el) => `${el.describe}'s accessible name and description are both "${el.name}"`)

/** (12) No ring after a pointer step; the focused or highlighted part has it after a key. */
const focusVisibleModality: GenericInvariant = (f) => {
  const out: string[] = []
  if (f.modality === "pointer" || f.modality === "touch") {
    for (const p of f.after.parts) {
      if (p.attrs["data-focus-visible"] !== undefined) {
        out.push(`${p.describe} has data-focus-visible after a ${f.modality} step`)
      }
    }
  } else if (f.modality === "keyboard") {
    const focused = f.after.focus.element
    const targets = [
      ...(focused?.part ? [focused] : []),
      ...f.after.parts.filter((p) => p.attrs["data-highlighted"] !== undefined),
    ]
    for (const t of targets) {
      if (t.attrs["data-focus-visible"] === undefined) {
        out.push(`${t.describe} lacks data-focus-visible after a keyboard step`)
      }
    }
  }
  return out
}

export const genericInvariants: Readonly<Partial<Record<GenericInvariantId, GenericInvariant>>> = {
  anchor,
  "no-errors": noErrors,
  "data-state": dataState,
  "machine-attrs": machineAttrs,
  names,
  "label-text": labelText,
  refs,
  "name-sources-not-inert": nameSourcesNotInert,
  "state-attrs": stateAttrs,
  "hidden-focus": hiddenFocus,
  "focus-kept": focusKept,
  "live-regions": liveRegions,
  "document-clean": documentClean,
  "name-not-description": nameNotDescription,
  "focus-visible-modality": focusVisibleModality,
}

const partNamed = (s: DomSnapshot, name: string | undefined) =>
  name === undefined ? [] : s.parts.filter((p) => p.part === name)

export const traitInvariants: Readonly<Partial<Record<Trait, GenericInvariant>>> = {
  /** (30) The trigger mirrors open state; content is gone, hidden or until-found when closed. */
  disclosure: (f) => {
    const out: string[] = []
    for (const t of partNamed(f.after, f.semantics["trigger"])) {
      if (t.attrs["aria-expanded"] !== String(isOpen(f))) {
        out.push(
          `${t.describe} aria-expanded="${t.attrs["aria-expanded"]}" but the state is ${f.state}`,
        )
      }
    }
    if (!isOpen(f)) {
      for (const c of partNamed(f.after, f.semantics["content"])) {
        if (!c.hidden && c.attrs["hidden"] !== "until-found") {
          out.push(`${c.describe} is still visible while ${f.state}`)
        }
      }
    }
    return out
  },
  /** Focus is never on body while a layer is open. */
  layer: (f) =>
    isOpen(f) && f.after.focus.onBody ? ["focus is on <body> while the layer is open"] : [],
  /** (13) After closing, focus is on the trigger or the declared final-focus part. */
  "restores-focus": (f) => {
    const target = f.semantics["finalFocus"] ?? f.semantics["trigger"]
    const closed = f.from !== null && f.from !== f.state && !isOpen(f)
    return closed && f.after.focus.part !== target
      ? [
          `after closing, focus is on ${f.after.focus.element?.describe ?? "<body>"}, expected the ${target} part`,
        ]
      : []
  },
  /**
   * While open: everything outside the layer that existed before (and is not kept visible by
   * the keep-visible rule) is inert, focus is inside, the page is scroll-locked, and <body>
   * has no pointer-events style. Closed: unlocked (the rest is document-clean's).
   */
  modal: (f) => {
    const out: string[] = []
    const locked =
      f.after.html["data-rind-scroll-locked"] !== undefined ||
      f.after.body["data-rind-scroll-locked"] !== undefined
    if (/pointer-events/.test(f.after.body["style"] ?? "")) {
      out.push("<body> has a pointer-events style")
    }
    if (!isOpen(f)) {
      if (locked) out.push("the page is still scroll-locked after closing")
      return out
    }
    for (const [sibling, attrs] of Object.entries(f.after.outside)) {
      // Nodes added while open (extensions, password managers) are left alone by design.
      if (!(sibling in f.baseline.outside)) continue
      if (attrs["data-rind-kept"] !== undefined || attrs["inert"] !== undefined) continue
      out.push(`${sibling} is outside the open modal layer but not inert`)
    }
    if (!f.after.focus.inInstance) {
      out.push(
        `focus is on ${f.after.focus.element?.describe ?? "<body>"}, outside the open modal layer`,
      )
    }
    if (!locked) out.push("the page is not scroll-locked while the modal layer is open")
    return out
  },
  /**
   * Closed content still mounted carries data-state="closed" and has a running exit
   * animation; once none runs it must be gone (the runner waits for that first).
   */
  presence: (f) => {
    if (isOpen(f)) return []
    const out: string[] = []
    for (const c of partNamed(f.after, f.semantics["content"])) {
      if (c.hidden && c.attrs["hidden"] !== undefined) continue
      if (c.attrs["data-state"] !== "closed") {
        out.push(
          `${c.describe} is mounted while closed without data-state="closed" (running animations: ${c.animations})`,
        )
      }
      if (c.animations === 0) {
        out.push(
          `${c.describe} is still mounted after its exit animations finished (running animations: 0)`,
        )
      }
    }
    return out
  },
  /**
   * Anchored popups: focus enters the popup only after its first placement; in a real
   * browser, the placed popup lies inside the visual viewport, on the side `data-side`
   * reports (not over its anchor on that axis), and a centred arrow points at the anchor.
   * Without layout (jsdom) only the focus rule runs.
   */
  anchored: (f) => {
    const pos = f.after.parts.find((p) => p.part === "positioner")
    if (!pos) return []
    const out: string[] = []
    const placing = pos.attrs["data-placing"] !== undefined
    const focused = f.after.focus.element
    if (
      placing &&
      focused &&
      pos.id &&
      (focused.id === pos.id || focused.within.includes(pos.id))
    ) {
      out.push(`focus entered ${pos.describe} before its first placement`)
    }
    if (placing || !f.after.viewport.layout || pos.hidden) return out
    // The tracker records the effective collision padding and the anchoring element's id.
    const style = (name: string) =>
      new RegExp(`${name}:\\s*([^;]*)`).exec(pos.attrs["style"] ?? "")?.[1]?.trim() ?? ""
    const [pt = 0, pr = pt, pb = pt, pl = pr] = style("--rind-collision-padding")
      .split(/\s+/)
      .filter(Boolean)
      .map((x) => Number.parseFloat(x))
    const vp = f.after.viewport
    // Inside the visual viewport minus the padding (a popup capped to it fits exactly).
    const v = {
      x: vp.x + pl,
      y: vp.y + pt,
      width: vp.width - pl - pr,
      height: vp.height - pt - pb,
    }
    const r = pos.rect
    // [edge, overflow past the padded boundary, its padding]
    const edges = [
      ["top", v.y - r.y, pt],
      ["left", v.x - r.x, pl],
      ["bottom", r.y + r.height - (v.y + v.height), pb],
      ["right", r.x + r.width - (v.x + v.width), pr],
    ] as const
    const side = pos.attrs["data-side"] ?? "?"
    for (const [edge, over, padding] of edges) {
      if (over <= 0.5) continue
      const past = over - padding
      out.push(
        past > 0.5
          ? `${pos.describe} (side ${side}) overflows the viewport's ${edge} edge by ${Math.round(past)} px (collision padding ${padding} px)`
          : `${pos.describe} (side ${side}) is inside the ${edge} collision padding (${padding} px) by ${Math.round(over)} px`,
      )
    }
    // Side and arrow checks against the element that anchors it: none for a point or virtual
    // anchor (a context menu at the pointer may overlap its trigger).
    const anchorId = style("--rind-anchor-id").replace(/^"|"$/g, "")
    if (anchorId === "") return out
    const anchor = f.after.parts.find((p) => p.id === anchorId && !p.hidden)
    if (!anchor || pos.attrs["data-anchor-hidden"] !== undefined) return out
    const a = anchor.rect
    const wrongSide =
      (side === "bottom" && r.y < a.y + a.height - 0.5) ||
      (side === "top" && r.y + r.height > a.y + 0.5) ||
      (side === "right" && r.x < a.x + a.width - 0.5) ||
      (side === "left" && r.x + r.width > a.x + 0.5)
    if (wrongSide) out.push(`${pos.describe} is not on the ${side} of ${anchor.describe}`)
    const arrow = f.after.parts.find((p) => p.part === "arrow" && !p.hidden)
    if (arrow && arrow.attrs["data-uncentered"] === undefined) {
      const vertical = side === "top" || side === "bottom"
      const tip = vertical
        ? arrow.rect.x + arrow.rect.width / 2
        : arrow.rect.y + arrow.rect.height / 2
      const [from, to] = vertical ? [a.x, a.x + a.width] : [a.y, a.y + a.height]
      if (tip < from - 0.5 || tip > to + 0.5) {
        out.push(`${arrow.describe} does not point at ${anchor.describe}`)
      }
    }
    return out
  },
  /** (8) A roving composite is one Tab stop. */
  "composite-roving": (f) => {
    // Controls inside a row (`item-control`) belong to the row's own tab group.
    const list = items(f.after).filter(exposed)
    const stops = list.filter((el) => el.attrs["tabindex"] === "0").length
    // No navigable item: the container itself is the one stop.
    const container = f.after.parts.some((p) => p.part !== "item" && p.attrs["tabindex"] === "0")
    const out =
      list.length > 0 && stops !== 1 && !(stops === 0 && container)
        ? [`${stops} items have tabindex="0"; expected exactly 1`]
        : []
    // A step that removed or filtered out the focused item leaves focus in the composite.
    if (f.before?.focus.inInstance && f.after.focus.onBody) {
      out.push("focus fell to <body> after the step (the focused item was removed?)")
    }
    return [...out, ...highlightChecks(f)]
  },
  /** (8, 9) Only the input or container is tabbable; activedescendant points into the popup. */
  "composite-activedescendant": (f) => {
    const out = [...highlightChecks(f)]
    out.push(
      ...items(f.after)
        .filter((el) => el.focusable && el.attrs["tabindex"] !== "-1")
        .map((el) => `${el.describe} is tabbable; only the input or container may be`),
    )
    for (const el of f.after.elements) {
      const id = el.attrs["aria-activedescendant"]
      if (!id) continue
      const target = f.after.elements.find((e) => e.id === id)
      if (!target) {
        out.push(`${el.describe} aria-activedescendant="${id}" is not a rendered item`)
        continue
      }
      if (target.attrs["data-highlighted"] === undefined) {
        out.push(
          `aria-activedescendant points at ${target.describe}, which is not data-highlighted`,
        )
      }
      const popups = ids(el.attrs["aria-controls"])
      if (popups.length > 0 && !popups.some((p) => target.within.includes(p))) {
        out.push(`aria-activedescendant points at ${target.describe}, outside the controlled popup`)
      }
    }
    return out
  },
  /** Explicit selection state on every item; it follows the machine's value, not highlight. */
  selectable: (f) => {
    const out: string[] = []
    const list = items(f.after).filter(exposed)
    for (const el of list) {
      const v = el.attrs["aria-selected"] ?? el.attrs["aria-checked"]
      if (v !== "true" && v !== "false") {
        out.push(`${el.describe} has no explicit aria-selected/aria-checked`)
      }
      if (isTrue(v) !== (el.attrs["data-selected"] !== undefined)) {
        out.push(`${el.describe}: selection state disagrees with data-selected`)
      }
    }
    const multi = f.after.elements.some((el) => isTrue(el.attrs["aria-multiselectable"]))
    const selected = list.filter((el) =>
      isTrue(el.attrs["aria-selected"] ?? el.attrs["aria-checked"]),
    )
    if (!multi && selected.length > 1) {
      out.push(`${selected.length} items are selected in single selection`)
    }
    // A step never adds a disabled item to the selection.
    const wasSelected = new Set(
      items(f.before ?? f.after)
        .filter((el) => isTrue(el.attrs["aria-selected"] ?? el.attrs["aria-checked"]))
        .map((el) => el.attrs["data-key"] ?? el.describe),
    )
    for (const el of selected) {
      if (
        isTrue(el.attrs["aria-disabled"]) &&
        !wasSelected.has(el.attrs["data-key"] ?? el.describe)
      ) {
        out.push(`${el.describe} is disabled but the step added it to the selection`)
      }
    }
    // Items identify their value by data-value, or (collections) by data-key.
    const itemValue = (el: ElementInfo) => el.attrs["data-value"] ?? el.attrs["data-key"]
    const value = f.values["value"]
    if (value !== undefined && value !== "all" && list.every((el) => itemValue(el) !== undefined)) {
      // Only values with a rendered item: a selection survives filtering and virtualization.
      const rendered = new Set(list.map((el) => itemValue(el)))
      const want = new Set(
        (Array.isArray(value) ? value : [value]).map(String).filter((v) => rendered.has(v)),
      )
      const have = new Set(selected.map((el) => itemValue(el) ?? ""))
      if (want.size !== have.size || [...want].some((v) => !have.has(v))) {
        out.push(
          `selected items [${[...have].join(", ")}] differ from the machine's value [${[...want].join(", ")}]`,
        )
      }
    }
    return out
  },
  /** aria-posinset within [1, setsize], unique and increasing in visible order, per set. */
  "set-metadata": (f) => {
    const out: string[] = []
    const groups = new Map<string, ElementInfo[]>()
    for (const el of items(f.after)) {
      if (!exposed(el) || el.attrs["aria-posinset"] === undefined) continue
      groups.set(el.group, [...(groups.get(el.group) ?? []), el])
    }
    for (const list of groups.values()) {
      let previous = 0
      const seen = new Set<number>()
      for (const el of list) {
        const pos = Number(el.attrs["aria-posinset"])
        const size = Number(el.attrs["aria-setsize"] ?? list.length)
        if (!(pos >= 1 && (size === -1 || pos <= size))) {
          out.push(`${el.describe} aria-posinset=${pos} outside [1, ${size}]`)
        }
        if (seen.has(pos)) out.push(`${el.describe} repeats aria-posinset=${pos}`)
        else if (pos < previous) {
          out.push(`${el.describe} aria-posinset=${pos} comes after ${previous} in visible order`)
        }
        seen.add(pos)
        previous = Math.max(previous, pos)
      }
    }
    // Set size is the collection's item count, unrendered (virtualized) items included.
    if (f.collectionSize !== undefined) {
      for (const el of items(f.after).filter(exposed)) {
        const size = el.attrs["aria-setsize"]
        if (
          size !== undefined &&
          el.attrs["aria-level"] === undefined &&
          Number(size) !== f.collectionSize
        ) {
          out.push(
            `${el.describe} aria-setsize=${size}, the collection has ${f.collectionSize} items`,
          )
        }
      }
    }
    return out
  },
  /**
   * aria-valuenow equals the machine's value in the same step; a numeric aria-valuetext
   * equals it too; a `value-text` part shows aria-valuetext (or the value).
   */
  valued: (f) => {
    const value = f.values["value"]
    if (typeof value !== "number") return []
    const out: string[] = []
    let valuetext: string | undefined
    for (const el of f.after.elements) {
      const now = el.attrs["aria-valuenow"]
      if (now !== undefined && Number(now) !== value) {
        out.push(`${el.describe} aria-valuenow="${now}", machine value ${value}`)
      }
      const text = el.attrs["aria-valuetext"]
      if (text === undefined) continue
      valuetext = text
      if (text.trim() === "") out.push(`${el.describe} has an empty aria-valuetext`)
      else if (/^-?\d+(\.\d+)?$/.test(text.trim()) && Number(text) !== value) {
        out.push(`${el.describe} aria-valuetext="${text}", machine value ${value}`)
      }
    }
    for (const p of f.after.parts.filter((x) => x.part === "value-text" && exposed(x))) {
      const want = valuetext ?? String(value)
      if (!p.text.includes(want)) out.push(`${p.describe} shows "${p.text}", expected "${want}"`)
    }
    return out
  },
  /** Live regions exist before their first message and are never hidden from AT. */
  "live-region": (f) => {
    const out = f.after.elements
      .filter((el) => f.after.liveRegions.includes(el.describe) && (el.inAriaHidden || el.inInert))
      .map((el) => `${el.describe} is a live region inside aria-hidden or inert`)
    for (const region of f.after.liveRegions) {
      if (!f.baseline.liveRegions.includes(region)) {
        out.push(`${region} did not exist before its first message`)
      }
    }
    return out
  },
}

/**
 * (AT 8) The result count is a status message on every platform. An item announcement (the
 * contract's focus announcement, or any item's accessible name) is made only where VoiceOver
 * ignores aria-activedescendant (quirk vo-activedescendant: Apple with WebKit): exactly one
 * per highlight change, for the new item; anywhere else it doubles the screen reader's own
 * speech. A declared section announcement is expected on entering a section where VoiceOver
 * is silent on sections (vo-section-entry: every Apple platform) and never elsewhere. Other
 * messages are not this invariant's business.
 */
const announcementParity: GenericInvariant = (f) => {
  const a = f.announcements
  if (!a || !f.observed || !f.before || !f.platform) return []
  const said = (f.stepAnnouncements ?? []).map((x) => x.message)
  const highlightedEl = (s: DomSnapshot) =>
    s.elements.find((e) => e.attrs["data-highlighted"] !== undefined)
  const highlighted = (s: DomSnapshot) => highlightedEl(s)?.id ?? null
  /** The section holding the highlighted item: the set its item belongs to. */
  const section = (s: DomSnapshot) => highlightedEl(s)?.group ?? null
  const count = (s: DomSnapshot) => items(s).filter(exposed).length
  // The declared functions take the contract's own observations, which `observed` is.
  const observed = f.observed as never
  const focusMessage = a.focusAnnouncement(observed)
  const countMessage = a.countAnnouncement(observed)
  const sectionMessage = a.sectionAnnouncement?.(observed)
  const highlightChanged =
    highlighted(f.after) !== null && highlighted(f.after) !== highlighted(f.before)
  const sectionChanged =
    highlightChanged && section(f.after) !== null && section(f.after) !== section(f.before)
  const resultsChanged = count(f.after) > 0 && count(f.after) !== count(f.before)
  const itemNames = new Set(
    items(f.after)
      .map((e) => e.name)
      .filter((n) => n !== ""),
  )
  const isItemAnnouncement = (m: string) => m === focusMessage || itemNames.has(m)
  const out: string[] = []
  if (resultsChanged && !said.includes(countMessage)) {
    out.push(`expected the count announcement "${countMessage}", heard ${JSON.stringify(said)}`)
  }
  if (sectionMessage !== undefined && sectionChanged) {
    const heard = said.includes(sectionMessage)
    if (quirkActive("vo-section-entry", { platform: f.platform })) {
      if (!heard) {
        out.push(
          `expected the section announcement "${sectionMessage}", heard ${JSON.stringify(said)}`,
        )
      }
    } else if (heard) {
      out.push(`announced the section "${sectionMessage}" where the screen reader speaks it`)
    }
  }
  if (!highlightChanged) return out
  const itemSpeech = said.filter(isItemAnnouncement)
  if (quirkActive("vo-activedescendant", { platform: f.platform })) {
    if (itemSpeech.length !== 1 || itemSpeech[0] !== focusMessage) {
      out.push(
        `expected exactly one item announcement, the focus announcement "${focusMessage}"; heard ${JSON.stringify(itemSpeech)}`,
      )
    }
  } else if (itemSpeech.length > 0) {
    out.push(
      `announced ${JSON.stringify(itemSpeech)} for the highlighted item where the screen reader already speaks it (double speech)`,
    )
  }
  return out
}

/** Runs every generic invariant plus those switched on by the contract's traits. */
export function checkGeneric(facts: StepFacts): readonly string[] {
  const out: string[] = []
  const exempt = facts.exempt
  const keep = (id: GenericInvariantId, messages: readonly string[]) =>
    exempt
      ? messages.filter((m) => {
          const part = /\[data-part=([^\]]+)\]/.exec(m)?.[1]
          return part === undefined || !exempt(id, part)
        })
      : messages
  for (const [id, check] of Object.entries(genericInvariants)) {
    // Keys of genericInvariants are invariant ids.
    out.push(...keep(id as GenericInvariantId, check?.(facts) ?? []))
  }
  // `modal` implies `layer` and `restores-focus`.
  const traits = new Set(facts.traits)
  if (traits.has("modal")) {
    traits.add("layer")
    traits.add("restores-focus")
  }
  for (const trait of traits) {
    out.push(...keep(trait as GenericInvariantId, traitInvariants[trait]?.(facts) ?? []))
  }
  if (facts.traits.includes("composite-activedescendant")) {
    out.push(
      ...keep("announcement-parity", announcementParity(facts)).map(
        (m) => `announcement-parity: ${m}`,
      ),
    )
  }
  return out
}

/** The anchored layout checks (trait `anchored`), for a single snapshot outside the runner. */
export const layoutInvariant: GenericInvariant = (f) => traitInvariants.anchored?.(f) ?? []
