// The Date Field's contract (date-field "Contract"): typing segment digits in the locale's
// order, steps, edges, clearing, paste and reset; queries read the hidden input (the ISO
// value), each segment's text and `aria-valuenow`, and the root's state attributes.

import type { DateValue } from "@internationalized/date"
import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { type DateSegmentType, type Draft, defaultValueText } from "../date-segments"
import {
  type DateFieldContext,
  type DateFieldProps,
  dateFieldMachine,
  formatFor,
  formValueOf,
} from "./date-field.machine"
import { dateFieldMessages } from "./date-field.messages"

type P =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "input"
  | "segment"
  | "segment-name"
  | "value-description"
  | "hidden-input"
type E = Env<P>

/** One segment of the field, by type. */
const seg = (env: E, type: DateSegmentType): Part => env.part("input").withAttr("data-type", type)

/** The editable segments in DOM (format) order. */
async function editable(env: E): Promise<readonly { type: DateSegmentType; part: Part }[]> {
  const out: { type: DateSegmentType; part: Part }[] = []
  for (const part of await env.part("input").withAttr("data-editable").all()) {
    // Sound: connect writes each editable segment's own type in data-type.
    const type = (await part.attr("data-type")) as DateSegmentType
    out.push({ type, part })
  }
  return out
}

/** The digits (or letter) to type into each segment for an ISO date or date-time. */
export function keysFor(type: DateSegmentType, iso: string, twelveHour: boolean): string {
  const [date = "", time = ""] = iso.split("T")
  const [y = "", m = "", d = ""] = date.split("-")
  const [h = "0", min = "0", s = "0"] = time.split(":")
  const hour = Number(h)
  switch (type) {
    case "year":
      return y.padStart(4, "0")
    case "month":
      return m.padStart(2, "0")
    case "day":
      return d.padStart(2, "0")
    case "hour":
      return String(twelveHour ? hour % 12 || 12 : hour).padStart(2, "0")
    case "minute":
      return min.padStart(2, "0")
    case "second":
      return s.slice(0, 2).padStart(2, "0")
    case "dayPeriod":
      return hour >= 12 ? "p" : "a"
    case "era":
      return ""
  }
}

/** Types every segment's keys in the order the segments are rendered (the locale's). */
async function fillSegments(env: E, iso: string) {
  const segments = await editable(env)
  const twelve = segments.some((s) => s.type === "dayPeriod")
  for (const { type, part } of segments) {
    const keys = keysFor(type, iso, twelve)
    if (keys !== "") await part.type(keys)
  }
}

const focusedSegment = async (env: E): Promise<DateSegmentType | null> => {
  for (const { type, part } of await editable(env)) if (await part.isFocused()) return type
  return null
}

const dirOf = async (env: E) => ((await env.part("root").attr("dir")) === "rtl" ? "rtl" : "ltr")

/** The segment the model's event is for: the focused one, else the first. */
async function active(env: E): Promise<Part> {
  const type = await focusedSegment(env)
  const first = (await editable(env))[0]
  if (type) return seg(env, type)
  if (!first) throw new Error("date-field: no editable segment")
  return first.part
}

const props = (p: Readonly<Record<string, unknown>>) => p as unknown as DateFieldProps
const ctx = (view: { context: unknown }) => view.context as DateFieldContext
/** The oracle value as the hidden input holds it (granularity from the oracle's format). */
const iso = (v: unknown, p?: Readonly<Record<string, unknown>>) => {
  const value = (v as DateValue | null | undefined) ?? null
  return formValueOf(value, p ? formatFor(props(p), value).options.granularity : "second")
}

/** The segment invariants (date-field "Segment Invariants"), exported for Time Field. */
export const dateSegmentInvariants: readonly Invariant<P, string>[] = [
  {
    name: "date-segment-native-inputs",
    check: async ({ env }) => {
      for (const { type, part } of await editable(env)) {
        if ((await part.tagName()) !== "input") return `the ${type} segment is not an <input>`
        if ((await part.attr("contenteditable")) !== null) {
          return `the ${type} segment is contenteditable`
        }
        const disabled = (await part.attr("disabled")) !== null
        if (!disabled && (await part.attr("tabindex")) === "-1") {
          return `the ${type} segment is out of the tab order`
        }
      }
      if ((await env.part("input").attr("contenteditable")) !== null) {
        return "the group is contenteditable"
      }
      return undefined
    },
  },
  {
    name: "date-segment-hidden-mirrors-value",
    check: async ({ env, values, props: p }) => {
      const hidden = env.part("hidden-input")
      if ((await hidden.count()) === 0) return undefined
      const want = iso(values["value"], p)
      const got = await hidden.value()
      return got === want ? undefined : `the hidden input holds "${got}", the value is "${want}"`
    },
  },
  {
    name: "date-segment-hidden-never-focused",
    check: async ({ env }) => {
      const hidden = env.part("hidden-input")
      if ((await hidden.count()) === 0) return undefined
      return (await hidden.isFocused()) ? "the hidden input has focus" : undefined
    },
  },
]

/** The oracle's segment values, in format order (the order the page renders them). */
function oracleSegments(view: { context: unknown; values: Record<string, unknown> }, p: unknown) {
  const f = formatFor(
    props(p as Record<string, unknown>),
    (view.values["value"] as DateValue | null) ?? null,
  )
  const draft: Draft = ctx(view).draft
  return { f, draft }
}

/** The Date Field's contract (date-field "Contract"). */
export const dateFieldContract = contract("date-field", {
  machine: dateFieldMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "error-message",
    "input",
    "segment",
    "segment-name",
    "value-description",
    "hidden-input",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    /**
     * Tabs into the focused (else first) segment. Keyboard only: typing into a text input
     * after a click shows no focus ring (interaction-modality), so a click into a segment
     * is a scenario test.
     */
    enter: {
      keyboard: async (env) => (await active(env)).focusWithTab(),
      done: async () => true,
    },
    /** Every segment typed in the locale's order from an ISO date (or date-time). */
    fill: {
      keyboard: async (env, date: string) => fillSegments(env, date),
      pointer: async (env, date: string) => {
        await (await active(env)).click()
        await fillSegments(env, date)
      },
      done: async () => true,
    },
    typeSegment: {
      keyboard: async (env, type: DateSegmentType, text: string) => seg(env, type).type(text),
      done: async () => true,
    },
    /** Into the focused segment (the model's INPUT). */
    typeFocused: {
      keyboard: async (env, text: string) => (await active(env)).type(text),
      done: async () => true,
    },
    step: {
      keyboard: async (
        env,
        type: DateSegmentType | null,
        d: "increase" | "decrease",
        o?: { large?: boolean },
      ) => {
        const target = type ? seg(env, type) : await active(env)
        if (o?.large) return target.press(d === "increase" ? "PageUp" : "PageDown")
        return target.press(d === "increase" ? "ArrowUp" : "ArrowDown")
      },
      done: async () => true,
    },
    toEdge: {
      keyboard: async (env, type: DateSegmentType | null, edge: "min" | "max") =>
        (type ? seg(env, type) : await active(env)).press(edge === "min" ? "Home" : "End"),
      done: async () => true,
    },
    /** ArrowRight / ArrowLeft as the user sees them (mirrored keys in rtl). */
    move: {
      keyboard: async (env, direction: "next" | "previous") => {
        const rtl = (await dirOf(env)) === "rtl"
        const right = (direction === "next") !== rtl
        await (await active(env)).press(right ? "ArrowRight" : "ArrowLeft")
      },
      done: async () => true,
    },
    backspace: {
      keyboard: async (env) => (await active(env)).press("Backspace"),
      done: async () => true,
    },
    clearSegment: {
      keyboard: async (env, type: DateSegmentType) => {
        const part = seg(env, type)
        for (let n = Math.max(1, (await part.value()).length); n > 0; n--) {
          await part.press("Backspace")
        }
      },
      done: async () => true,
    },
    /** Select all, then Backspace: every segment cleared. */
    clear: {
      keyboard: async (env) => {
        const part = await active(env)
        await part.press("A", { mod: true })
        await part.press("Backspace")
      },
      done: async () => true,
    },
    paste: {
      keyboard: async (env, text: string) => (await active(env)).paste(text),
      done: async () => true,
    },
    /** Leaves the field (focus outside). */
    leave: {
      pointer: async (env) => env.pointerOutside(),
      keyboard: async (env) => env.pointerOutside(),
      done: async () => true,
    },
    composeOpen: {
      keyboard: async (env, text: string) =>
        (await active(env)).compose([...text].map((_, i) => text.slice(0, i + 1))),
      done: { isComposing: true },
    },
    composeEnd: {
      keyboard: async (env, committed: string) => (await active(env)).compose([], committed),
      done: { isComposing: false },
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    /** The hidden input's value (ISO, or "" while empty, incomplete or impossible). */
    value: async (env) => env.part("hidden-input").value(),
    segments: async (env) => {
      const out: {
        type: DateSegmentType
        text: string
        value: number | null
        placeholder: boolean
      }[] = []
      for (const { type, part } of await editable(env)) {
        const now = await part.attr("aria-valuenow")
        out.push({
          type,
          text: await part.value(),
          value: now === null ? null : Number(now),
          placeholder: (await part.attr("data-placeholder")) !== null,
        })
      }
      return out
    },
    focusedSegment,
    isInvalid: async (env) => {
      for (const { part } of await editable(env)) {
        if ((await part.attr("aria-invalid")) === "true") return true
      }
      return false
    },
    /** The control's own validity reason ("" when valid). */
    validity: async (env) => (await env.part("hidden-input").attr("data-validity")) ?? "",
    isComplete: async (env) => (await env.part("root").attr("data-complete")) !== null,
    isFocused: async (env) => (await env.part("root").attr("data-focus")) !== null,
    isComposing: async (env) => (await env.part("root").attr("data-composing")) !== null,
    isDisabled: async (env) => {
      const first = (await editable(env))[0]
      return first ? (await first.part.attr("disabled")) !== null : false
    },
    isReadOnly: async (env) => {
      const first = (await editable(env))[0]
      return first ? (await first.part.attr("readonly")) !== null : false
    },
  },
  states: {
    idle: { isFocused: false, isComposing: false },
    editing: { isFocused: true, isComposing: false },
    composing: { isComposing: true },
  },
  events: {
    "SEGMENT.FOCUS": {
      action: "enter",
      event: (view) => ({ segment: firstSegment(view) }),
    },
    "SEGMENT.BLUR": { action: "leave", event: () => ({ related: "outside" }) },
    INPUT: {
      action: "typeFocused",
      args: (() => ["1"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view), data: "1" }),
    },
    INCREASE: {
      action: "step",
      args: (() => [null, "increase"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    DECREASE: {
      action: "step",
      args: (() => [null, "decrease"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    PAGE_PREV: {
      action: "step",
      args: (() => [null, "increase", { large: true }]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    PAGE_NEXT: {
      action: "step",
      args: (() => [null, "decrease", { large: true }]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    FIRST: {
      action: "toEdge",
      args: (() => [null, "min"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    LAST: {
      action: "toEdge",
      args: (() => [null, "max"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    NEXT: {
      action: "move",
      args: (() => ["next"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    PREV: {
      action: "move",
      args: (() => ["previous"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    BACKSPACE: {
      action: "backspace",
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view) }),
    },
    CLEAR_ALL: { action: "clear" },
    PASTE: {
      action: "paste",
      args: ((view: { values: Record<string, unknown>; context: unknown }) => [
        pasteFor(view),
      ]) as never,
      event: (view) => ({ text: pasteFor(view) }),
    },
    "COMPOSITION.START": { action: "composeOpen", args: (() => ["１"]) as never },
    "COMPOSITION.END": {
      action: "composeEnd",
      args: (() => ["１"]) as never,
      event: (view) => ({ segment: ctx(view).active ?? firstSegment(view), text: "１" }),
    },
    RESET: {
      from: {
        idle: "resetForm",
        editing: { skip: "pressing Reset blurs the segment first (a commit): a scenario test" },
        composing: { skip: "pressing Reset ends the composition first (a blur)" },
      },
    },
    "INPUT.ADOPT": { skip: "autofill is a scenario test" },
    "VALUE.SYNCED": { skip: "the parent's prop change; walked by the controlled configurations" },
    "FORMAT.CHANGED": { skip: "a locale change is a scenario test" },
    "$props:value": { skip: "the parent's prop change; walked by the controlled configurations" },
    "$props:locale": { skip: "a locale change is a scenario test" },
    "$props:calendar": { skip: "a calendar change is a scenario test" },
    "$props:granularity": { skip: "a granularity change is a scenario test" },
    "$props:hourCycle": { skip: "an hour-cycle change is a scenario test" },
    "$props:hideTimeZone": { skip: "a zone display change is a scenario test" },
    "$props:shouldForceLeadingZeros": { skip: "a padding change is a scenario test" },
  },
  traits: ["valued", "form-associated", "field-associated"],
  valued: {
    // Each editable segment's oracle value, in the order they are rendered.
    values: (view, p) => {
      const { f, draft } = oracleSegments(view as never, p)
      return f.editable.map((t) => draft[t]?.value ?? null)
    },
    valueText: (view, index, p) => {
      const { f, draft } = oracleSegments(view as never, p)
      const type = f.editable[index]
      if (!type) return ""
      const e = draft[type]
      const spoken = defaultValueText(type, e, draft, f)
      return spoken === null || !e || e.value === null
        ? dateFieldMessages.empty
        : dateFieldMessages.segmentValueText({
            type,
            value: e.value,
            text: e.text,
            formatted: spoken,
          })
    },
  },
  // Focusing a segment enters editing (and commits the one left): every segment, every state.
  commitsOnFocus: [
    { part: "segment", state: "idle" },
    { part: "segment", state: "editing" },
    { part: "segment", state: "composing" },
  ],
  invariants: dateSegmentInvariants,
  formInput: {
    expected: (vals) => ({ value: iso(vals["value"]) }),
    silentEvents: ["RESET"],
  },
})

/** The first editable segment of the oracle's format. */
function firstSegment(view: { context: unknown }): DateSegmentType {
  return ctx(view).format.editable[0] ?? "month"
}

/** An ISO text of the oracle's kind to paste: its value a year later, else a fixed one. */
function pasteFor(view: { values: Record<string, unknown>; context: unknown }): string {
  const v = (view.values["value"] as DateValue | null | undefined) ?? null
  if (v) return v.add({ years: 1 }).toString()
  const { options } = ctx(view).format
  if (options.granularity === "day") return "2030-06-15"
  return options.timeZone === "UTC" ? "2030-06-15T10:20" : `2030-06-15T10:20[${options.timeZone}]`
}
