// The Number Input's contract (spec "Contract"): typing, commits, key steps, stepper presses
// and holds (pointer steps, time advanced by the adapter), reset; queries read the ARIA
// attributes, the text, the hidden input and the triggers' state.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { formatValue, type NumberInputProps, numberInputMachine } from "./number-input.machine"
import { canStep } from "./number-input.math"

type P =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "control"
  | "input"
  | "increment-trigger"
  | "decrement-trigger"
  | "hidden-input"
type E = Env<P>

type Direction = "increase" | "decrease"
const triggerOf = (d: Direction): "increment-trigger" | "decrement-trigger" =>
  d === "increase" ? "increment-trigger" : "decrement-trigger"

const value = async (env: E): Promise<number | null> => {
  const input = env.part("input")
  const now = await input.attr("aria-valuenow")
  if (now !== null) return Number(now)
  // The iOS quirk drops the value attributes: the hidden input still has the number.
  if ((await input.attr("role")) === "spinbutton") return null
  const raw = await env.part("hidden-input").value()
  return raw === "" ? null : Number(raw)
}
const isDisabled = async (env: E) => (await env.part("input").attr("disabled")) !== null
const isReadOnly = async (env: E) => (await env.part("input").attr("readonly")) !== null
const can = async (env: E, d: Direction) => {
  const t = env.part(triggerOf(d))
  return (await t.count()) > 0 && (await t.attr("aria-disabled")) !== "true"
}

async function stepKeys(env: E, d: Direction, o: { large?: boolean; page?: boolean } = {}) {
  const input = env.part("input")
  if (o.page) return input.press(d === "increase" ? "PageUp" : "PageDown")
  return input.press(d === "increase" ? "ArrowUp" : "ArrowDown", { shift: o.large === true })
}

const props = (p: Readonly<Record<string, unknown>>) => p as unknown as NumberInputProps

/** Per-contract invariants (spec "Number Input Invariants"; counts are step invariants). */
export const numberInputInvariants: readonly Invariant<P, string>[] = [
  {
    name: "number-input-hidden-mirrors-value",
    check: async ({ env, values }) => {
      const v = (values["value"] as number | null | undefined) ?? null
      const hidden = await env.part("hidden-input").value()
      const want = v === null ? "" : String(v)
      return hidden === want
        ? undefined
        : `the hidden input holds "${hidden}", the value is ${want || "empty"}`
    },
  },
  {
    name: "number-input-text-is-formatted",
    check: async ({ env, values, props: p }) => {
      const input = env.part("input")
      if (await input.isFocused()) return undefined
      const v = (values["value"] as number | null | undefined) ?? null
      const want = formatValue(v, props(p))
      const text = await input.value()
      return text === want ? undefined : `the unfocused input shows "${text}", expected "${want}"`
    },
  },
  {
    name: "number-input-trigger-disabled-at-bound",
    check: async ({ env, values, props: p }) => {
      const v = (values["value"] as number | null | undefined) ?? null
      const np = props(p)
      const locked = np.disabled === true || np.readOnly === true
      for (const d of ["increase", "decrease"] as const) {
        const t = env.part(triggerOf(d))
        if ((await t.count()) === 0) continue
        const off = locked || !canStep(v, d === "increase" ? 1 : -1, np)
        const aria = (await t.attr("aria-disabled")) === "true"
        if (aria !== off) return `${triggerOf(d)} aria-disabled is ${aria}, expected ${off}`
        if (!locked && (await t.attr("disabled")) !== null) {
          return `${triggerOf(d)} has native disabled while the field is enabled`
        }
      }
      return undefined
    },
  },
]

/** The model's typed text: one more digit after the current text. */
const typed = (view: { context: unknown }) => `${(view.context as { text: string }).text}1`

/** The Number Input's contract (spec "Contract"). */
export const numberInputContract = contract("number-input", {
  machine: numberInputMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "error-message",
    "control",
    "input",
    "increment-trigger",
    "decrement-trigger",
    "hidden-input",
  ],
  locate: ({
    name,
    role = "spinbutton",
  }: {
    readonly name: string | RegExp
    readonly role?: "spinbutton" | "textbox"
  }) => ({
    role,
    name,
  }),
  actions: {
    type: {
      keyboard: async (env, text: string) => env.part("input").type(text),
      done: async () => true,
    },
    /**
     * Replaces the text and Tabs away to commit. The text is cleared with Backspace from
     * the end (a click puts the caret there): select-all is not a step every
     * environment performs.
     */
    fill: {
      keyboard: async (env, text: string) => {
        const input = env.part("input")
        await input.click()
        for (let n = (await input.value()).length; n > 0; n--) await input.press("Backspace")
        await input.type(text)
        await env.keyboard("Tab")
      },
      done: async () => true,
    },
    commit: {
      keyboard: async (env) => env.part("input").press("Enter"),
      done: async () => true,
    },
    step: {
      // A trigger click (one step); large steps are keyboard only.
      pointer: async (env, d: Direction, o?: { large?: boolean }) => {
        if (o?.large) throw new Error("step: large steps are keyboard only")
        return env.part(triggerOf(d)).click()
      },
      touch: async (env, d: Direction, o?: { large?: boolean }) => {
        if (o?.large) throw new Error("step: large steps are keyboard only")
        return env.part(triggerOf(d)).tap()
      },
      keyboard: async (env, d: Direction, o?: { large?: boolean }) => stepKeys(env, d, o),
      done: async () => true,
    },
    /** PageUp / PageDown: a large step (keyboard only). */
    pageStep: {
      keyboard: async (env, d: Direction) => stepKeys(env, d, { page: true }),
      done: async () => true,
    },
    toEdge: {
      keyboard: async (env, edge: "min" | "max") =>
        env.part("input").press(edge === "min" ? "Home" : "End"),
      done: async () => true,
    },
    /**
     * Presses a trigger and keeps it down (the model's PRESS.START), with a mouse in every
     * run so the oracle's pointer type matches; touch presses are scenario tests.
     */
    pressStepper: {
      pointer: async (env, d: Direction) =>
        env.part(triggerOf(d)).pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: "mouse" }),
      none: {
        keyboard: "a held stepper is a pointer gesture; ArrowUp / ArrowDown repeat with the key",
      },
      done: async () => true,
    },
    releaseStepper: {
      pointer: async (env, d: Direction) =>
        env.part(triggerOf(d)).pointer("up", { at: { x: 0.5, y: 0.5 }, pointerType: "mouse" }),
      none: { keyboard: "a held stepper is a pointer gesture" },
      done: async () => true,
    },
    cancelStepper: {
      pointer: async (env, d: Direction) =>
        env.part(triggerOf(d)).pointer("cancel", { at: { x: 0.5, y: 0.5 }, pointerType: "mouse" }),
      none: { keyboard: "only a pointer gesture is cancelled by the browser" },
      done: async () => true,
    },
    /** Holds a trigger for `ms` (time advanced by the adapter), then releases it. */
    holdStepper: {
      pointer: async (env, d: Direction, ms: number) => {
        const t = env.part(triggerOf(d))
        await t.pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: "mouse" })
        await env.advance(ms)
        await t.pointer("up", { at: { x: 0.5, y: 0.5 }, pointerType: "mouse" })
      },
      touch: async (env, d: Direction, ms: number) => {
        const t = env.part(triggerOf(d))
        await t.pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
        await env.advance(ms)
        await t.pointer("up", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
      },
      // The key twin: one ArrowUp / ArrowDown per repeat.
      keyboard: async (env, d: Direction, ms: number) => {
        const repeats = 1 + Math.max(0, Math.floor((ms - 400) / 60))
        for (let i = 0; i < repeats; i++) await stepKeys(env, d)
      },
      done: async () => true,
    },
    /** One wheel tick; its key twin is one arrow (the wheel itself is a scenario test). */
    wheel: {
      keyboard: async (env, d: Direction) => stepKeys(env, d),
      done: async () => true,
    },
    /** Replaces the text and commits (a clipboard paste is a scenario test). */
    paste: {
      keyboard: async (env, text: string) => {
        const input = env.part("input")
        await input.click()
        for (let n = (await input.value()).length; n > 0; n--) await input.press("Backspace")
        await input.type(text)
        await input.press("Enter")
      },
      done: async () => true,
    },
    composeOpen: {
      keyboard: async (env, text: string) =>
        env.part("input").compose([...text].map((_, i) => text.slice(0, i + 1))),
      done: { isComposing: true },
    },
    composeEnd: {
      keyboard: async (env, committed: string) => env.part("input").compose([], committed),
      done: { isComposing: false },
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    value,
    text: async (env) => env.part("input").value(),
    valueText: async (env) => (await env.part("input").attr("aria-valuetext")) ?? "",
    formValue: async (env) => env.part("hidden-input").value(),
    canIncrement: async (env) => can(env, "increase"),
    canDecrement: async (env) => can(env, "decrease"),
    isInvalid: async (env) => (await env.part("input").attr("aria-invalid")) === "true",
    isDisabled,
    isReadOnly,
    isSpinning: async (env) => (await env.part("root").attr("data-spinning")) !== null,
    isComposing: async (env) => (await env.part("root").attr("data-composing")) !== null,
  },
  states: {
    idle: { isSpinning: false, isComposing: false },
    composing: { isComposing: true },
    pressing: { isSpinning: false },
    spinning: { isSpinning: true },
  },
  events: {
    INPUT: {
      from: {
        idle: {
          action: "type",
          args: (() => ["1"]) as never,
          event: (view) => ({ text: typed(view) }),
        },
        composing: { skip: "typing while composing is the composition's own (composeOpen)" },
      },
    },
    COMMIT: {
      from: {
        idle: { action: "commit", event: () => ({ source: "enter" }) },
        composing: { skip: "a blur mid-composition commits at its end: a scenario test" },
        pressing: { skip: "a blur while a trigger is held: a scenario test" },
        spinning: { skip: "a blur while a trigger is held: a scenario test" },
      },
    },
    PASTE: { skip: "a clipboard paste is a scenario test (the Part API has no clipboard)" },
    INCREASE: {
      action: "step",
      args: (() => ["increase"]) as never,
      event: () => ({ large: false }),
    },
    DECREASE: {
      action: "step",
      args: (() => ["decrease"]) as never,
      event: () => ({ large: false }),
    },
    PAGE_PREV: {
      action: "pageStep",
      args: (() => ["increase"]) as never,
      event: () => ({ large: false }),
    },
    PAGE_NEXT: {
      action: "pageStep",
      args: (() => ["decrease"]) as never,
      event: () => ({ large: false }),
    },
    FIRST: { action: "toEdge", args: (() => ["min"]) as never, event: () => ({ large: false }) },
    LAST: { action: "toEdge", args: (() => ["max"]) as never, event: () => ({ large: false }) },
    WHEEL: { skip: "the wheel is a scenario test (its key twin is INCREASE)" },
    "PRESS.START": {
      action: "pressStepper",
      args: (() => ["increase"]) as never,
      event: () => ({ trigger: "increment", pointerType: "mouse" }),
    },
    "PRESS.END": {
      action: "releaseStepper",
      args: (() => ["increase"]) as never,
      event: () => ({ trigger: "increment", pointerType: "mouse" }),
    },
    "PRESS.CANCEL": {
      action: "cancelStepper",
      args: (() => ["increase"]) as never,
      event: () => ({ trigger: "increment", pointerType: "mouse" }),
    },
    PRESS: { skip: "the trailing activation of a press (part of every stepper click)" },
    "PRESS.LEAVE": { skip: "leaving a held trigger is a scenario test" },
    "COMPOSITION.START": { action: "composeOpen", args: (() => ["１"]) as never },
    "COMPOSITION.END": {
      action: "composeEnd",
      args: (() => ["１２"]) as never,
      event: () => ({ text: "１２" }),
    },
    RESET: {
      from: {
        idle: "resetForm",
        pressing: { skip: "the Reset button cannot be pressed by the pointer holding a trigger" },
        spinning: { skip: "the Reset button cannot be pressed by the pointer holding a trigger" },
        composing: { skip: "pressing Reset ends the composition first (a blur)" },
      },
    },
    "INPUT.ADOPT": { skip: "autofill is a scenario test" },
    FOCUS: { skip: "covered by every action" },
    BLUR: { skip: "covered by every action" },
    "VALUE.SYNCED": { skip: "the parent's prop change; walked by the controlled configurations" },
    "LOCK.CHANGED": { skip: "disabled mid-hold is a scenario test" },
    "$props:value": { skip: "the parent's prop change; walked by the controlled configurations" },
    "$props:disabled": { skip: "disabled mid-hold is a scenario test" },
    "$props:readOnly": { skip: "read-only mid-hold is a scenario test" },
  },
  traits: ["valued", "form-associated", "field-associated"],
  valued: {
    values: (view) => [(view.values["value"] as number | null | undefined) ?? null],
    // messages.valueText over the number-parsing text, or messages.empty.
    valueText: (view, _i, p) => {
      const np = props(p)
      const v = (view.values["value"] as number | null | undefined) ?? null
      return v === null
        ? np.messages.empty
        : np.messages.valueText({ value: v, text: np.parser.valueText(v, { step: np.step }) })
    },
  },
  // Focusing a trigger blurs the input: a typed draft commits (spec "Typing And Commit").
  commitsOnFocus: [
    { part: "increment-trigger", state: "idle" },
    { part: "decrement-trigger", state: "idle" },
  ],
  invariants: numberInputInvariants,
  formInput: {
    expected: (vals) => {
      const v = (vals["value"] as number | null | undefined) ?? null
      return { value: v === null ? "" : String(v) }
    },
    silentEvents: ["RESET"],
  },
})
