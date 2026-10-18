// Range mode's contract (date-field spec "Contract", range variant): the pair located by its
// group's name; each end typed in the locale's order; queries read the two hidden inputs, the
// segments per end and the root's attributes. Pair invariants are checked after every step.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import type { DateSegmentType } from "../date-segments"
import { keysFor } from "./date-field.contract"
import { datePickerActions, datePickerInvariants, datePickerQueries } from "./date-picker.contract"
import { dateRangeFieldMachine } from "./date-range.machine"

type P =
  | "root"
  | "label"
  | "error-message"
  | "input"
  | "start"
  | "end"
  | "separator"
  | "hidden-input"
type E = Env<P>
type Edge = "start" | "end"

/** The ISO values a model step types into each end (set by a model test). */
export const dateRangeArgs: {
  current: {
    readonly start: string
    readonly end: string
    /** The ends the instance was rendered with (ISO), when it has a default value. */
    readonly initial?: { readonly start: string; readonly end: string }
  }
} = {
  current: { start: "2026-10-14", end: "2026-10-16" },
}

/** An end's editable segments, in DOM (format) order. */
async function editable(
  env: E,
  edge: Edge,
): Promise<readonly { type: DateSegmentType; part: Part }[]> {
  const out: { type: DateSegmentType; part: Part }[] = []
  for (const part of await env.part(edge).withAttr("data-editable").all()) {
    // Sound: connect writes each editable segment's own type in data-type.
    out.push({ type: (await part.attr("data-type")) as DateSegmentType, part })
  }
  return out
}

async function fillEnd(env: E, edge: Edge, iso: string) {
  const segments = await editable(env, edge)
  const twelve = segments.some((s) => s.type === "dayPeriod")
  for (const { type, part } of segments) {
    const keys = keysFor(type, iso, twelve)
    if (keys !== "") await part.type(keys)
  }
}

// The hidden inputs are the root's own parts (not inside the group).
const hiddenValue = async (env: E, edge: Edge) => {
  for (const h of await env.part("hidden-input").all()) {
    if ((await h.attr("data-edge")) === edge) return h.value()
  }
  return ""
}

/** An end's shown date as ISO (Gregorian day segments), "" while any segment is empty. */
async function shownIso(env: E, edge: Edge): Promise<string | null> {
  const n: Partial<Record<DateSegmentType, number>> = {}
  for (const { type, part } of await editable(env, edge)) {
    const v = await part.attr("aria-valuenow")
    if (v === null) return ""
    n[type] = Number(v)
  }
  // Only Gregorian dates are read back (an era or a time segment: not checked).
  if (Object.keys(n).some((t) => t !== "year" && t !== "month" && t !== "day")) return null
  const pad = (x: number | undefined, w: number) => String(x ?? 0).padStart(w, "0")
  return `${pad(n.year, 4)}-${pad(n.month, 2)}-${pad(n.day, 2)}`
}

/** Pair invariants (spec "Range Mode — Pair Invariants") read from the page. */
export const dateRangeInvariants: readonly Invariant<P, string>[] = [
  {
    // The model's actions type `dateRangeArgs.current[edge]` into that end only: an end
    // shows either nothing or its own argument, never the other end's or a rewritten date.
    name: "date-range-other-end-untouched",
    check: async ({ env }) => {
      for (const edge of ["start", "end"] as const) {
        const shown = await shownIso(env, edge)
        const typed = dateRangeArgs.current[edge]
        const initial = dateRangeArgs.current.initial?.[edge]
        if (shown !== null && shown !== "" && shown !== typed && shown !== initial) {
          return `the ${edge} shows ${shown}, but only ${typed} was typed into it`
        }
      }
      return undefined
    },
  },
  {
    // The public value (the hidden inputs) is the one derived from the two shown ends.
    name: "date-range-value-is-derived",
    check: async ({ env, props }) => {
      const [s, e] = [await shownIso(env, "start"), await shownIso(env, "end")]
      if (s === null || e === null) return undefined
      // Unavailable dates and a required pair are the coordinator's own tests.
      if (props["isDateUnavailable"]) return undefined
      const valid = s !== "" && e !== "" && s <= e
      const want = valid ? { start: s, end: e } : { start: "", end: "" }
      const have = { start: await hiddenValue(env, "start"), end: await hiddenValue(env, "end") }
      return have.start === want.start && have.end === want.end
        ? undefined
        : `hidden inputs ${JSON.stringify(have)}, derived ${JSON.stringify(want)}`
    },
  },
  {
    name: "date-range-hidden-never-focused",
    check: async ({ env }) => {
      for (const h of await env.part("hidden-input").all()) {
        if (await h.isFocused()) return "a hidden input has focus"
      }
      return undefined
    },
  },
  {
    name: "date-range-two-hidden-inputs",
    check: async ({ env }) => {
      const n = (await env.part("hidden-input").all()).length
      return n === 2 ? undefined : `${n} hidden inputs (exactly two expected)`
    },
  },
  {
    name: "date-range-form-values-together",
    check: async ({ env }) => {
      const [s, e] = [await hiddenValue(env, "start"), await hiddenValue(env, "end")]
      return (s === "") === (e === "") ? undefined : `one hidden input is empty: "${s}" / "${e}"`
    },
  },
  {
    name: "date-range-one-group",
    check: async ({ env }) => {
      const groups = await env.part("input").all()
      for (const g of groups)
        if ((await g.attr("role")) !== "group") return "the range input is not a group"
      return undefined
    },
  },
]

export const dateRangeFieldContract = contract("date-field", {
  machine: dateRangeFieldMachine,
  anatomy: [
    "root",
    "label",
    "error-message",
    "input",
    "start",
    "end",
    "separator",
    "hidden-input",
    "trigger",
    "clear-trigger",
    "content",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    ...datePickerActions,
    /** Both ends typed in the locale's order, start first (focus moves to the end). */
    fill: {
      keyboard: async (env, range: { start: string; end: string }) => {
        await fillEnd(env, "start", range.start)
        await fillEnd(env, "end", range.end)
      },
      pointer: async (env, range: { start: string; end: string }) => {
        const first = (await editable(env, "start"))[0]
        await first?.part.click()
        await fillEnd(env, "start", range.start)
        await fillEnd(env, "end", range.end)
      },
      done: async () => true,
    },
    fillStart: {
      keyboard: async (env, iso: string) => fillEnd(env, "start", iso),
      done: async () => true,
    },
    fillEnd: {
      keyboard: async (env, iso: string) => fillEnd(env, "end", iso),
      done: async () => true,
    },
    typeSegment: {
      keyboard: async (env, edge: Edge, type: DateSegmentType, text: string) =>
        env.part(edge).withAttr("data-type", type).type(text),
      done: async () => true,
    },
    /** Select all, then Backspace, in the first start segment: both ends clear. */
    clear: {
      keyboard: async (env) => {
        const first = (await editable(env, "start"))[0]
        if (!first) return
        await first.part.press("A", { mod: true })
        await first.part.press("Backspace")
      },
      done: async () => true,
    },
    step: {
      keyboard: async (
        env,
        edge: Edge,
        type: DateSegmentType,
        d: "increase" | "decrease",
        o?: { large?: boolean },
      ) => {
        const target = env.part(edge).withAttr("data-type", type)
        if (o?.large) return target.press(d === "increase" ? "PageUp" : "PageDown")
        return target.press(d === "increase" ? "ArrowUp" : "ArrowDown")
      },
      done: async () => true,
    },
    paste: {
      keyboard: async (env, edge: Edge, text: string) => {
        const first = (await editable(env, edge))[0]
        if (first) await first.part.paste(text)
      },
      done: async () => true,
    },
    /** Every segment of the end cleared with Backspace, last to first. */
    clearEnd: {
      keyboard: async (env) => {
        for (const { part } of [...(await editable(env, "end"))].reverse()) {
          while ((await part.attr("aria-valuenow")) !== null) await part.press("Backspace")
        }
      },
      done: async () => true,
    },
    resetForm: {
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      done: async () => true,
    },
  },
  queries: {
    /** The two hidden inputs' values ("" unless the pair is a valid range). */
    range: async (env: E) => ({
      start: await hiddenValue(env, "start"),
      end: await hiddenValue(env, "end"),
    }),
    segments: async (env: E, edge: Edge) => {
      const out: { type: DateSegmentType; text: string; value: string | null }[] = []
      for (const { type, part } of await editable(env, edge)) {
        out.push({ type, text: await part.value(), value: await part.attr("aria-valuenow") })
      }
      return out
    },
    focusedSegment: async (env: E) => {
      for (const edge of ["start", "end"] as const) {
        for (const { type, part } of await editable(env, edge)) {
          if (await part.isFocused()) return { edge, type }
        }
      }
      return null
    },
    /** The start hidden input's validity flags (the pair's own validity element). */
    validity: async (env: E) => {
      for (const h of await env.part("hidden-input").all()) {
        if ((await h.attr("data-edge")) === "start") return h.attr("data-validity")
      }
      return null
    },
    isInvalid: async (env: E) => (await env.part("root").attr("data-invalid")) !== null,
    invalidEdge: async (env: E) => env.part("root").attr("data-invalid-edge"),
    isComplete: async (env: E) => (await env.part("root").attr("data-complete")) !== null,
    ...datePickerQueries,
  },
  states: { idle: {} },
  events: {
    "START.COMMIT": {
      action: "fillStart",
      args: (() => [dateRangeArgs.current.start]) as never,
      event: () => ({ value: null, reason: "SEGMENT.COMMIT" }),
    },
    "END.COMMIT": {
      action: "fillEnd",
      args: (() => [dateRangeArgs.current.end]) as never,
      event: () => ({ value: null, reason: "SEGMENT.COMMIT" }),
    },
    "START.VALIDITY": { skip: "reported by the start field itself (its own validity tests)" },
    "END.VALIDITY": { skip: "reported by the end field itself (its own validity tests)" },
    "VALUE.SYNC": { skip: "a parent's value: the coordinator and DOM tests" },
    "$props:value": { skip: "a parent's value: the coordinator and DOM tests" },
    CLEAR: "clear",
    PICK: { skip: "a picker's calendar range: the picker tests" },
    RESET: { skip: "a form reset: the DOM tests" },
  },
  traits: ["field-associated"],
  // The hidden inputs forward focus to the first segment (hidden-form-input), by design.
  commitsOnFocus: [{ part: "hidden-input", state: "idle" }],
  invariants: [...dateRangeInvariants, ...datePickerInvariants],
})
