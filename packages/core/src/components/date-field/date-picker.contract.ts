// The Date Field picker's driver actions and queries (date-field spec "Contract", picker
// variant): open from the trigger or Alt+ArrowDown, pick a day in the popover's calendar,
// clear; read the open state and the calendar's selection. Shared by single and range mode.

import type { Env } from "../../contract/env"

type PickerParts = "trigger" | "clear-trigger" | "content"
type E = Env<PickerParts>

const isOpen = async (env: E) =>
  (await env.part("content").exists()) && (await env.part("content").attr("data-state")) === "open"

/** The calendar day cell of `iso` in the open content. */
const day = (env: E, iso: string) => env.part("content").withAttr("data-value", iso)

export const datePickerActions = {
  /** The trigger: pressed (pointer) or Enter (keyboard). */
  openPicker: {
    keyboard: async (env: E) => env.part("trigger").press("Enter"),
    pointer: async (env: E) => env.part("trigger").click(),
    // Open and placed: until the first placement the popup takes no pointer input (the
    // positioner's first-frame style), so a pick right after the open would miss.
    done: async (env: E) =>
      (await isOpen(env)) && (await env.part("content").attr("data-placing")) === null,
  },
  /** A day of the open calendar, ISO `YYYY-MM-DD` (twice in range mode: start, then end). */
  pickDate: {
    keyboard: async (env: E, iso: string) => day(env, iso).press("Enter"),
    pointer: async (env: E, iso: string) => day(env, iso).click(),
    done: async () => true,
  },
  closePicker: {
    keyboard: async (env: E) => env.part("content").press("Escape"),
    pointer: async (env: E) => env.part("trigger").click(),
    done: async (env: E) => !(await isOpen(env)),
  },
  clearPicker: {
    keyboard: async (env: E) => env.part("clear-trigger").press("Enter"),
    pointer: async (env: E) => env.part("clear-trigger").click(),
    done: async () => true,
  },
} as const

export const datePickerQueries = {
  isOpen,
  /** The ISO days selected in the open calendar, in order. */
  calendarSelection: async (env: E) => {
    const out: string[] = []
    if (!(await isOpen(env))) return out
    for (const cell of await env.part("content").scoped("calendar", "cell").all()) {
      if ((await cell.attr("aria-selected")) === "true")
        out.push((await cell.attr("data-value")) ?? "")
    }
    return out
  },
} as const

type InvariantFor = {
  readonly name: string
  readonly check: (ctx: { readonly env: E & Env<"hidden-input"> }) => Promise<string | undefined>
}

/**
 * Picker invariants (spec "Picker — Picker Invariants"), skipped when no trigger is rendered:
 * the trigger's `aria-expanded` is the open state, open content is a named dialog, and the
 * open calendar selects exactly the days the hidden inputs hold.
 */
export const datePickerInvariants: readonly InvariantFor[] = [
  {
    name: "date-picker-expanded-is-open",
    check: async ({ env }) => {
      if (!(await env.part("trigger").exists())) return undefined
      const expanded = (await env.part("trigger").attr("aria-expanded")) === "true"
      return expanded === (await isOpen(env))
        ? undefined
        : `aria-expanded="${expanded}" but the content is ${expanded ? "closed" : "open"}`
    },
  },
  {
    name: "date-picker-content-is-named-dialog",
    check: async ({ env }) => {
      if (!(await isOpen(env))) return undefined
      const content = env.part("content")
      if ((await content.attr("role")) !== "dialog") return "the open content is not a dialog"
      return (await content.accessibleName()) === "" ? "the open content has no name" : undefined
    },
  },
  {
    name: "date-picker-views-agree",
    check: async ({ env }) => {
      if (!(await isOpen(env))) return undefined
      const days: string[] = []
      for (const h of await env.part("hidden-input").all()) {
        const v = await h.value()
        if (v !== "") days.push(v.slice(0, 10))
      }
      const shown = await datePickerQueries.calendarSelection(env)
      // A range selects every day between its ends: compare the ends.
      const ends = shown.length > 1 ? [shown[0], shown.at(-1)] : shown
      const want = days.length === 2 && days[0] === days[1] ? [days[0]] : days
      return JSON.stringify(ends) === JSON.stringify(want)
        ? undefined
        : `the calendar selects ${JSON.stringify(ends)}, the field holds ${JSON.stringify(want)}`
    },
  },
]
