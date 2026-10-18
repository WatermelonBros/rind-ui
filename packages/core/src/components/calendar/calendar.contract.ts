import { CalendarDate, parseDate } from "@internationalized/date"
import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { calendarMachine, viewIn } from "./calendar.machine"
import type { CalendarView } from "./calendar.period"

type P =
  | "root"
  | "header"
  | "heading"
  | "prev-trigger"
  | "next-trigger"
  | "grid"
  | "grid-header"
  | "header-cell"
  | "grid-body"
  | "row"
  | "cell"
  | "prompt"
  | "view-trigger"
type E = Env<P>

/** The shown view (`data-view` on the root). */
const viewOf = async (env: E) => ((await env.part("root").attr("data-view")) ?? "days") as string

/**
 * An ISO date, month ("2027-03") or year ("2031") as the ISO date of its cell in the shown view:
 * a period's cell carries its first day.
 */
async function cellIso(env: E, iso: string): Promise<string> {
  const full = iso.length <= 5 ? `${iso}-01-01` : iso.length <= 8 ? `${iso}-01` : iso
  const view = await viewOf(env)
  if (view === "months") return `${full.slice(0, -3)}-01`
  if (view === "years") return `${full.slice(0, -6)}-01-01`
  return full
}

/** The in-month cell of an ISO date (a period's cell in the month and year views), if visible. */
async function cellOf(env: E, given: string): Promise<Part | null> {
  const iso = await cellIso(env, given)
  for (const cell of await env.part("cell").all()) {
    if (
      (await cell.attr("data-value")) === iso &&
      (await cell.attr("data-outside-month")) === null
    ) {
      return cell
    }
  }
  return null
}

/** The focused date: the one cell in the tab sequence. */
async function focusedDate(env: E): Promise<string | null> {
  for (const cell of await env.part("cell").all()) {
    if ((await cell.attr("tabindex")) === "0") return cell.attr("data-value")
  }
  return null
}

/** Focuses the focused cell (the grid's tab stop) when focus is elsewhere. */
async function enterGrid(env: E) {
  const iso = await focusedDate(env)
  const cell = iso ? await cellOf(env, iso) : null
  if (cell && !(await cell.isFocused())) await cell.focus()
}

/** Keyboard moves to `iso` through calendar-navigation's keys: years, months, then days. */
async function keyTo(env: E, given: string) {
  await enterGrid(env)
  const iso = await cellIso(env, given)
  const view = await viewOf(env)
  const target = parseDate(iso)
  for (let i = 0; i < 400; i++) {
    const at = await focusedDate(env)
    if (at === null) throw new Error("calendar: no focused cell")
    if (at === iso) return
    const from = parseDate(at)
    const months = (target.year - from.year) * 12 + (target.month - from.month)
    const press = (key: "PageDown" | "PageUp" | "ArrowRight" | "ArrowLeft", shift = false) =>
      env.keyboard(key, shift ? { shift: true } : undefined)
    // Period views: a page is a year of months; years move one by one.
    if (view === "years") await press(target.compare(from) > 0 ? "ArrowRight" : "ArrowLeft")
    else if (view === "months" && Math.abs(months) >= 12)
      await press(months > 0 ? "PageDown" : "PageUp")
    else if (view === "months") await press(months > 0 ? "ArrowRight" : "ArrowLeft")
    else if (Math.abs(months) >= 12) await press(months > 0 ? "PageDown" : "PageUp", true)
    else if (months !== 0) await press(months > 0 ? "PageDown" : "PageUp")
    else await press(target.compare(from) > 0 ? "ArrowRight" : "ArrowLeft")
  }
  throw new Error(`calendar: could not reach ${iso} with the keyboard`)
}

/** Pointer paging until the date's month (period) is visible. */
async function pageTo(env: E, given: string) {
  const iso = await cellIso(env, given)
  const target = parseDate(iso)
  for (let i = 0; i < 240; i++) {
    if (await cellOf(env, iso)) return
    const first = (await env.part("cell").all())[0]
    const firstIso = first ? await first.attr("data-value") : null
    const before = firstIso
      ? parseDate(firstIso).compare(new CalendarDate(target.year, target.month, 1)) > 0
      : false
    await env.part(before ? "prev-trigger" : "next-trigger").click()
  }
  throw new Error(`calendar: ${iso} never became visible`)
}

/** Calendar invariants (spec "Calendar Invariants") read from the page. */
export const calendarInvariants: readonly Invariant<P, string>[] = [
  {
    name: "calendar-one-tab-stop",
    check: async ({ env }) => {
      const cells = await env.part("cell").all()
      let stops = 0
      for (const c of cells) if ((await c.attr("tabindex")) === "0") stops += 1
      const disabled = (await env.part("root").attr("data-disabled")) !== null
      if (disabled)
        return stops === 0 ? undefined : `${stops} cells are tab stops in a disabled calendar`
      return stops === 1 ? undefined : `${stops} cells have tabindex=0 (exactly one expected)`
    },
  },
  {
    name: "calendar-one-focus",
    check: async ({ env }) => {
      let n = 0
      for (const c of await env.part("cell").all())
        if ((await c.attr("data-focus")) !== null) n += 1
      return n <= 1 ? undefined : `${n} cells carry data-focus`
    },
  },
  {
    name: "calendar-placeholders-inert",
    check: async ({ env }) => {
      for (const c of await env.part("cell").all()) {
        if ((await c.attr("data-outside-month")) === null) continue
        if ((await c.attr("tabindex")) !== null) return "a placeholder cell is focusable"
        if ((await c.attr("aria-selected")) === "true") return "a placeholder cell is selected"
      }
      return undefined
    },
  },
  {
    name: "calendar-today",
    check: async ({ env }) => {
      let n = 0
      for (const c of await env.part("cell").all())
        if ((await c.attr("aria-current")) === "date") n += 1
      return n <= 1 ? undefined : `${n} cells carry aria-current="date"`
    },
  },
  {
    name: "calendar-iso-values",
    check: async ({ env }) => {
      for (const c of await env.part("cell").all()) {
        const v = await c.attr("data-value")
        // Years before 1 or after 9999 (a BC page) carry the extended ISO year.
        if (!v || !/^([+-]\d{6}|\d{4})-\d{2}-\d{2}$/.test(v))
          return `a cell's data-value "${v}" is not an ISO date`
      }
      return undefined
    },
  },
]

/** Range invariants (spec "Range Invariants"), read from the page; silent in other modes. */
export const rangeInvariants: readonly Invariant<P, string>[] = [
  {
    name: "calendar-range-selection",
    check: async ({ env }) => {
      // Range mode renders the prompt part; other modes have no range to check.
      if (!(await env.part("prompt").exists())) return undefined
      for (const c of await env.part("cell").all()) {
        if ((await c.attr("aria-selected")) !== "true") continue
        if ((await c.attr("data-in-range")) === null)
          return `${await c.attr("data-value")} is aria-selected outside the committed range`
        if ((await c.attr("data-preview")) !== null && (await c.attr("data-in-range")) === null)
          return `preview cell ${await c.attr("data-value")} is aria-selected`
      }
      return undefined
    },
  },
  {
    name: "calendar-range-anchor",
    check: async ({ env }) => {
      const anchored = (await env.part("root").attr("data-anchored")) !== null
      let anchors = 0
      let previews = 0
      for (const c of await env.part("cell").all()) {
        if ((await c.attr("data-anchor")) !== null) anchors += 1
        if ((await c.attr("data-preview")) !== null) previews += 1
      }
      if (!anchored && anchors > 0) return `${anchors} cells carry data-anchor with no anchor`
      if (!anchored && previews > 0) return `${previews} cells carry data-preview with no anchor`
      return anchors <= 1 ? undefined : `${anchors} cells carry data-anchor`
    },
  },
  {
    name: "calendar-range-order",
    check: async ({ env }) => {
      let start: string | null = null
      let end: string | null = null
      for (const c of await env.part("cell").all()) {
        if ((await c.attr("data-range-start")) !== null) start = await c.attr("data-value")
        if ((await c.attr("data-range-end")) !== null) end = await c.attr("data-value")
      }
      return start && end && start > end
        ? `range start ${start} is after its end ${end}`
        : undefined
    },
  },
]

/** The visible cells carrying an attribute, as ISO dates. */
async function cellsWith(env: E, attr: string): Promise<string[]> {
  const out: string[] = []
  for (const c of await env.part("cell").all()) {
    if ((await c.attr(attr)) !== null && (await c.attr("data-outside-month")) === null) {
      out.push((await c.attr("data-value")) ?? "")
    }
  }
  return out
}

/** The Calendar's contract (spec "Contract"). */
export const calendarContract = contract("calendar", {
  machine: calendarMachine,
  anatomy: [
    "root",
    "header",
    "heading",
    "prev-trigger",
    "next-trigger",
    "grid",
    "grid-header",
    "header-cell",
    "grid-body",
    "row",
    "cell",
    "prompt",
    "view-trigger",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    select: {
      pointer: async (env: E, iso: string) => {
        await pageTo(env, iso)
        await (await cellOf(env, iso))?.click()
      },
      keyboard: async (env: E, iso: string) => {
        await keyTo(env, iso)
        await env.keyboard("Enter")
      },
      done: async () => true,
    },
    // Keyboard only: focus without selecting is a keyboard move.
    focusDate: {
      keyboard: async (env: E, iso: string) => keyTo(env, iso),
      done: async () => true,
    },
    nextPage: {
      pointer: async (env: E) => env.part("next-trigger").click(),
      // The trigger by keyboard (PageDown in the grid moves the focus: NAVIGATE).
      keyboard: async (env: E) => {
        const trigger = env.part("next-trigger")
        await trigger.focus()
        await trigger.press("Enter")
      },
      done: async () => true,
    },
    previousPage: {
      pointer: async (env: E) => env.part("prev-trigger").click(),
      keyboard: (env: E) => env.keyboard("PageUp"),
      done: async () => true,
    },
    /** Range mode: two selections (an anchor, then the end). */
    selectRange: {
      pointer: async (env: E, start: string, end: string) => {
        await pageTo(env, start)
        await (await cellOf(env, start))?.click()
        await pageTo(env, end)
        await (await cellOf(env, end))?.click()
      },
      touch: async (env: E, start: string, end: string) => {
        await pageTo(env, start)
        await (await cellOf(env, start))?.tap()
        await pageTo(env, end)
        await (await cellOf(env, end))?.tap()
      },
      keyboard: async (env: E, start: string, end: string) => {
        await keyTo(env, start)
        await env.keyboard("Enter")
        await keyTo(env, end)
        await env.keyboard("Enter")
      },
      done: async (env: E, start: string, end: string) => {
        const [x, y] = [await cellIso(env, start), await cellIso(env, end)]
        const [a, b] = x <= y ? [x, y] : [y, x]
        const from = await cellsWith(env, "data-range-start")
        const to = await cellsWith(env, "data-range-end")
        // An end on another page is not visible: the anchor is gone either way.
        return (
          (await env.part("root").attr("data-anchored")) === null &&
          (from.length === 0 || from[0] === a) &&
          (to.length === 0 || to[0] === b)
        )
      },
    },
    /** Range mode: the first selection only. */
    startRange: {
      pointer: async (env: E, iso: string) => {
        await pageTo(env, iso)
        await (await cellOf(env, iso))?.click()
      },
      keyboard: async (env: E, iso: string) => {
        await keyTo(env, iso)
        await env.keyboard("Enter")
      },
      done: async () => true,
    },
    /** Range mode: Escape drops the range in progress. */
    cancel: {
      keyboard: async (env: E) => {
        await enterGrid(env)
        await env.keyboard("Escape")
      },
      done: async (env: E) => (await env.part("root").attr("data-anchored")) === null,
    },
    /** The heading button: one view up (days, months, years). */
    viewUp: {
      // At maxView (or with a fixed view) there is no button: nothing to press.
      pointer: async (env: E) => {
        const trigger = env.part("view-trigger")
        if (await trigger.exists()) await trigger.click()
      },
      keyboard: async (env: E) => {
        const trigger = env.part("view-trigger")
        if (!(await trigger.exists())) return
        await trigger.focus()
        await trigger.press("Enter")
      },
      done: async () => true,
    },
    /** Escape in the grid: one view down. */
    viewDown: {
      keyboard: async (env: E) => {
        await enterGrid(env)
        await env.keyboard("Escape")
      },
      done: async () => true,
    },
    press: {
      keyboard: async (
        env: E,
        key:
          | "ArrowRight"
          | "ArrowLeft"
          | "ArrowUp"
          | "ArrowDown"
          | "Home"
          | "End"
          | "PageUp"
          | "PageDown"
          | "Enter"
          | "Space",
      ) => {
        await enterGrid(env)
        await env.keyboard(key)
      },
      done: async () => true,
    },
  },
  queries: {
    value: async (env: E) => {
      const out: string[] = []
      for (const c of await env.part("cell").all()) {
        if (
          (await c.attr("aria-selected")) === "true" &&
          (await c.attr("data-outside-month")) === null
        ) {
          out.push((await c.attr("data-value")) ?? "")
        }
      }
      return out
    },
    focusedDate,
    heading: async (env: E) => env.part("heading").text(),
    visibleMonths: async (env: E) => env.part("grid").count(),
    isSelected: async (env: E, iso: string) =>
      (await (await cellOf(env, iso))?.attr("aria-selected")) === "true",
    isUnavailable: async (env: E, iso: string) =>
      (await (await cellOf(env, iso))?.attr("data-unavailable")) != null,
    isDisabled: async (env: E, iso: string) =>
      (await (await cellOf(env, iso))?.attr("data-disabled")) != null,
    today: async (env: E) => {
      for (const c of await env.part("cell").all()) {
        if ((await c.attr("aria-current")) === "date") return c.attr("data-value")
      }
      return null
    },
    isInvalid: async (env: E) => (await env.part("root").attr("data-invalid")) !== null,
    isFocused: async (env: E) => (await env.part("root").attr("data-focus")) !== null,
    /** Range mode: the committed range's visible ends (ISO), or null. */
    range: async (env: E) => {
      const start = (await cellsWith(env, "data-range-start"))[0]
      const end = (await cellsWith(env, "data-range-end"))[0]
      return start && end ? { start, end } : null
    },
    anchor: async (env: E) => (await cellsWith(env, "data-anchor"))[0] ?? null,
    preview: async (env: E) => cellsWith(env, "data-preview"),
    isAnchored: async (env: E) => (await env.part("root").attr("data-anchored")) !== null,
    /** The shown view: "days", "months" or "years". */
    view: viewOf,
  },
  states: { idle: { isFocused: false }, focused: { isFocused: true } },
  events: {
    "CELL.PRESS": {
      action: "select",
      args: ((view: { values: { focusedValue: { toString(): string } } }) => [
        view.values.focusedValue.toString(),
      ]) as never,
      event: (view) => ({
        date: (view as unknown as { values: { focusedValue: unknown } }).values.focusedValue,
        modality: "pointer",
      }),
    },
    SELECT_FOCUSED: {
      action: "select",
      args: ((view: { values: { focusedValue: { toString(): string } } }) => [
        view.values.focusedValue.toString(),
      ]) as never,
      event: () => ({ composing: false }),
    },
    NAVIGATE: {
      action: "press",
      args: (() => ["ArrowRight"]) as never,
      // ArrowRight is the next day, or the next period in the month and year views.
      event: (view) => ({
        move:
          viewIn((view as unknown as { values: { view?: CalendarView } }).values.view, {
            minView: (view as unknown as { props?: { minView?: CalendarView } }).props?.minView,
          }) === "days"
            ? "next-day"
            : "next",
        composing: false,
      }),
    },
    "VIEW.UP": { action: "viewUp", event: () => ({ modality: "pointer" }) },
    "VIEW.DOWN": {
      from: {
        idle: { skip: "Escape reaches the calendar only with focus in a grid" },
        focused: "viewDown",
      },
    },
    PAGE: { action: "nextPage", event: () => ({ direction: 1, modality: "pointer" }) },
    // Escape is the grid's key: from idle it needs focus in the grid first (a state change).
    CANCEL: {
      from: {
        idle: { skip: "Escape reaches the calendar only with focus in a grid" },
        focused: "cancel",
      },
    },
    LEAVE: { skip: "focus or a press leaving the calendar: the DOM scenario tests" },
    "VALUE.SYNC": { skip: "a parent's value: machine and DOM tests" },
    "$props:value": { skip: "a parent's value: machine and DOM tests" },
    "CELL.FOCUS": { skip: "covered by every action" },
    "GRID.FOCUS": { skip: "covered by every action" },
    "GRID.BLUR": { skip: "covered by every action" },
    "CELL.HOVER": { skip: "hover is a scenario test" },
    "GRID.HOVER_END": { skip: "hover is a scenario test" },
    "FOCUS.SYNC": { skip: "a parent's focusedValue: machine and scenario tests" },
    CONSTRAINTS: { skip: "a changed minimum: machine tests" },
    "$props:focusedValue": { skip: "a parent's focusedValue: machine and scenario tests" },
    "$props:minValue": { skip: "a changed minimum: machine tests" },
    "$props:maxValue": { skip: "a changed maximum: machine tests" },
  },
  semantics: { item: "cell" },
  traits: ["selectable", "composite-roving"],
  // Focus entering a cell moves the focused date (idle → focused); it never selects.
  commitsOnFocus: [
    { part: "cell", state: "idle" },
    { part: "cell", state: "focused" },
    // Focus on a trigger leaves the grid (focused → idle): the next paging is announced.
    { part: "prev-trigger", state: "focused" },
    { part: "next-trigger", state: "focused" },
    { part: "view-trigger", state: "focused" },
  ],
  invariants: [...calendarInvariants, ...rangeInvariants],
})
