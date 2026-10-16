import { CalendarDate, parseDate } from "@internationalized/date"
import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { calendarMachine } from "./calendar.machine"

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
type E = Env<P>

/** The in-month cell of an ISO date, if visible. */
async function cellOf(env: E, iso: string): Promise<Part | null> {
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
async function keyTo(env: E, iso: string) {
  await enterGrid(env)
  const target = parseDate(iso)
  for (let i = 0; i < 400; i++) {
    const at = await focusedDate(env)
    if (at === null) throw new Error("calendar: no focused cell")
    if (at === iso) return
    const from = parseDate(at)
    const months = (target.year - from.year) * 12 + (target.month - from.month)
    const press = (key: "PageDown" | "PageUp" | "ArrowRight" | "ArrowLeft", shift = false) =>
      env.keyboard(key, shift ? { shift: true } : undefined)
    if (Math.abs(months) >= 12) await press(months > 0 ? "PageDown" : "PageUp", true)
    else if (months !== 0) await press(months > 0 ? "PageDown" : "PageUp")
    else await press(target.compare(from) > 0 ? "ArrowRight" : "ArrowLeft")
  }
  throw new Error(`calendar: could not reach ${iso} with the keyboard`)
}

/** Pointer paging until the date's month is visible. */
async function pageTo(env: E, iso: string) {
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
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v))
          return `a cell's data-value "${v}" is not an ISO date`
      }
      return undefined
    },
  },
]

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
      keyboard: async (env: E) => {
        await enterGrid(env)
        await env.keyboard("PageDown")
      },
      done: async () => true,
    },
    previousPage: {
      pointer: async (env: E) => env.part("prev-trigger").click(),
      keyboard: async (env: E) => {
        await enterGrid(env)
        await env.keyboard("PageUp")
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
      event: () => ({ move: "next-day", composing: false }),
    },
    PAGE: { action: "nextPage", event: () => ({ direction: 1, modality: "pointer" }) },
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
  ],
  invariants: calendarInvariants,
})
