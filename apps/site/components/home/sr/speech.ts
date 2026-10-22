// What NVDA (Chrome, browse mode) and VoiceOver (Safari) say for an item, from their recorded
// output in W3C ARIA-AT (aria-at.w3.org) and NVDA's own ordering rules (source/speech/speech.py,
// _shouldSpeakContentFirst). Each speech is a list of chunks, as NVDA's Speech Viewer shows it.
import type { Container, Item } from "./buffer"

export type Reader = "nvda" | "voiceover"
/** arrow: line by line (content last); jump: a quick-nav key or Tab (content first) */
export type Move = "arrow" | "jump" | "focus"

const NVDA_ROLE: Record<string, string> = {
  link: "link",
  button: "button",
  switch: "switch",
  checkbox: "check box",
  radio: "radio button",
  tab: "tab",
  slider: "slider",
  textbox: "edit",
  searchbox: "edit",
  combobox: "combo box",
  option: "option",
  menuitem: "menu item",
  menuitemcheckbox: "check menu item",
  menuitemradio: "radio menu item",
  spinbutton: "spin button",
  img: "graphic",
  progressbar: "progress bar",
  meter: "meter",
}
const VO_ROLE: Record<string, string> = {
  ...NVDA_ROLE,
  checkbox: "checkbox",
  textbox: "edit text",
  searchbox: "search text field",
  combobox: "combo box",
  img: "image",
}

const attr = (el: Element, n: string) => el.getAttribute(n)

function level(el: Element): string {
  const l = attr(el, "aria-level") ?? /^h([1-6])$/i.exec(el.tagName)?.[1] ?? "2"
  return l
}

function roleWord(item: Item, reader: Reader): string {
  const el = item.el
  if (item.role === "button" && attr(el, "aria-pressed") !== null) return "toggle button"
  return (reader === "nvda" ? NVDA_ROLE : VO_ROLE)[item.role] ?? ""
}

function position(el: Element, role: string): string {
  const set = attr(el, "aria-setsize")
  const pos = attr(el, "aria-posinset")
  if (set && pos) return `${pos} of ${set}`
  if (role !== "radio" && role !== "tab") return ""
  const group = el.closest("[role='radiogroup'], [role='tablist']")
  if (!group) return ""
  const peers = [...group.querySelectorAll(`[role='${role}'], input[type='radio']`)]
  const i = peers.indexOf(el)
  return i >= 0 ? `${i + 1} of ${peers.length}` : ""
}

/** The item's states, worded for the reader, in its order. */
export function states(item: Item, reader: Reader): string[] {
  const el = item.el
  const out: string[] = []
  const nv = reader === "nvda"
  const checked =
    attr(el, "aria-checked") ??
    (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
      ? String(el.checked)
      : null)
  if (item.role === "switch") {
    if (checked === "true") out.push("on")
    else if (checked !== null) out.push("off")
  } else if (item.role === "radio") {
    if (checked === "true") out.push(nv ? "checked" : "selected")
    else if (nv) out.push("not checked")
  } else if (checked === "true") out.push("checked")
  else if (checked === "mixed") out.push(nv ? "half checked" : "mixed")
  else if (checked === "false") out.push(nv ? "not checked" : "unchecked")
  const pressed = attr(el, "aria-pressed")
  if (pressed === "true") out.push(nv ? "pressed" : "selected")
  else if (pressed === "false" && nv) out.push("not pressed")
  const expanded = attr(el, "aria-expanded")
  if (expanded === "true") out.push("expanded")
  else if (expanded === "false") out.push("collapsed")
  if (attr(el, "aria-selected") === "true" && item.role !== "option" && nv) out.push("selected")
  if (attr(el, "aria-required") === "true" || (el as HTMLInputElement).required)
    out.push("required")
  if (attr(el, "aria-invalid") === "true") out.push(nv ? "invalid entry" : "invalid data")
  if (attr(el, "aria-disabled") === "true" || (el as HTMLButtonElement).disabled)
    out.push(nv ? "unavailable" : "dimmed")
  if (item.role === "slider" || item.role === "spinbutton" || item.role === "progressbar") {
    const v = attr(el, "aria-valuetext") ?? attr(el, "aria-valuenow")
    if (v) out.push(v)
  }
  if ((item.role === "textbox" || item.role === "searchbox") && el instanceof HTMLInputElement) {
    if (el.value) out.push(el.value)
    else if (nv) out.push("blank")
  }
  return out
}

/** What the reader says on entering a container (and on leaving it, arrow moves only). */
export function enter(c: Container, reader: Reader): string[] {
  if (c.kind === "list")
    return reader === "nvda" ? ["list", `with ${c.count} items`] : [`list, ${c.count} items`]
  if (c.kind === "region") return [c.name, "region"]
  if (c.kind === "radiogroup")
    return [c.name, reader === "nvda" ? "grouping" : "radio group"].filter(Boolean)
  if (c.kind === "tablist")
    return [c.name, reader === "nvda" ? "tab control" : "tab group"].filter(Boolean)
  if (c.kind === "group") return [c.name, reader === "nvda" ? "grouping" : "group"].filter(Boolean)
  if (c.kind === "dialog" || c.kind === "alertdialog")
    return [c.name, reader === "nvda" ? "dialog" : "web dialog"].filter(Boolean)
  return reader === "nvda" ? [`${c.kind} landmark`] : [c.kind]
}
export function exit(c: Container, reader: Reader): string[] {
  const what =
    c.kind === "list"
      ? "list"
      : c.kind === "region"
        ? "region"
        : c.kind === "group" || c.kind === "radiogroup"
          ? "grouping"
          : c.kind === "tablist"
            ? "tab control"
            : c.kind === "dialog" || c.kind === "alertdialog"
              ? "dialog"
              : `${c.kind} landmark`
  return reader === "nvda" ? [`out of ${what}`] : [`end of ${what.replace(" landmark", "")}`]
}

// symbols as a screen reader pronounces them at its default punctuation level
const SYMBOLS: Record<string, string> = {
  "→": "right arrow",
  "←": "left arrow",
  "↗": "north east arrow",
  "↓": "down arrow",
  "↑": "up arrow",
  "✓": "check",
  "×": "times",
}
const spoken = (text: string) =>
  text
    .replace(/[→←↗↓↑✓×]/g, (c) => ` ${SYMBOLS[c] ?? c} `)
    .replace(/\s+/g, " ")
    .trim()

/** The item itself, in the reader's order for this kind of move. */
export function speakItem(item: Item, reader: Reader, move: Move): string[] {
  if (item.role === "text") return [spoken(item.name)]
  const name = spoken(item.name)
  const st = states(item, reader)
  const pos = position(item.el, item.role)
  if (item.role === "heading") {
    if (reader === "voiceover") return [`heading level ${level(item.el)}`, name]
    return move === "arrow"
      ? ["heading", `level ${level(item.el)}`, name]
      : [name, "heading", `level ${level(item.el)}`]
  }
  const role = roleWord(item, reader)
  if (reader === "voiceover") {
    if (item.role === "slider") return [...st, name, role].filter(Boolean)
    if (item.role === "tab")
      return [name, st.includes("selected") ? "selected tab" : "tab", pos].filter(Boolean)
    if (item.role === "link" && move === "arrow") return [role, name]
    const exp = st.filter((s) => s === "expanded" || s === "collapsed")
    if (exp.length) return [name, `${exp[0]} ${role}`]
    return [name, ...st, role, pos].filter(Boolean)
  }
  // NVDA: edit fields and combo boxes always name first; otherwise content last on arrow moves
  const contentFirst =
    move !== "arrow" || ["textbox", "searchbox", "combobox", "slider"].includes(item.role)
  const desc = move === "focus" && item.description ? [item.description] : []
  return (contentFirst ? [name, role, ...st, pos, ...desc] : [role, ...st, pos, name]).filter(
    Boolean,
  )
}

/** A full utterance for moving from `from` to `to`: containers left and entered, then the item. */
export function speakMove(from: Item | null, to: Item, reader: Reader, move: Move): string[] {
  const out: string[] = []
  const before = from?.path ?? []
  const after = to.path
  let common = 0
  while (
    common < before.length &&
    common < after.length &&
    before[common]?.el === after[common]?.el
  )
    common++
  // NVDA reports leaving containers only when reading line by line
  if (move === "arrow")
    for (let i = before.length - 1; i >= common; i--) {
      const c = before[i]
      if (c) out.push(...exit(c, reader))
    }
  for (let i = common; i < after.length; i++) {
    const c = after[i]
    if (c) out.push(...enter(c, reader))
  }
  out.push(...speakItem(to, reader, move))
  return out
}
