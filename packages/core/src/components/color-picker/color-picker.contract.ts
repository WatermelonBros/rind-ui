// The Color Picker's contract (spec "Contract"): the picker's own actions and queries; the
// children are driven by their own drivers, scoped by the testing package's `getColorPicker`.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { cssColorOf } from "../color-swatch/color-swatch.contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor, tryParseColor } from "../shared/color/parse"
import { colorPickerMachine } from "./color-picker.machine"

type P =
  | "root"
  | "label"
  | "control"
  | "trigger"
  | "positioner"
  | "content"
  | "value-text"
  | "value-swatch"
  | "format-select"
  | "format-trigger"
  | "view"
  | "eye-dropper-trigger"
  | "hidden-input"
type E = Env<P>

const isOpen = async (env: E) => {
  if ((await env.part("root").attr("data-inline")) !== null) return true
  return (
    (await env.part("content").exists()) &&
    (await env.part("content").attr("data-state")) === "open"
  )
}
const isInline = async (env: E) => (await env.part("root").attr("data-inline")) !== null

export const colorPickerInvariants: readonly Invariant<P, string>[] = [
  {
    name: "color-picker-hidden-input-is-the-colour",
    check: async ({ env }) => {
      const form = await env.part("hidden-input").value()
      const root = await cssColorOf(await env.part("root").attr("style"))
      const a = tryParseColor(form)
      const b = tryParseColor(root)
      if (!a || !b) return `the hidden input "${form}" or the root colour "${root}" is not a colour`
      return formatColor(a, "hex") === formatColor(b, "hex")
        ? undefined
        : `the hidden input holds ${form}, the picker shows ${root}`
    },
  },
  {
    name: "color-picker-children-agree",
    check: async ({ env }) => {
      if (!(await isOpen(env))) return undefined
      const want = tryParseColor(await cssColorOf(await env.part("root").attr("style")))
      if (!want) return undefined
      const opaque = (c: NonNullable<typeof want>) => formatColor({ ...c, alpha: 1 }, "hex")
      // Every Area in the content shows the picker's colour (a bound Area has no value of its own).
      for (const area of await env.part("content").scoped("color-area", "root").all()) {
        const got = tryParseColor(await cssColorOf(await area.attr("style")))
        if (got && opaque(got) !== opaque(want)) {
          return `a Color Area in the content shows ${opaque(got)}, the picker ${opaque(want)}`
        }
      }
      return undefined
    },
  },
  {
    name: "color-picker-expanded-is-open",
    check: async ({ env }) => {
      if (await isInline(env)) return undefined
      const expanded = await env.part("trigger").attr("aria-expanded")
      const open = await isOpen(env)
      return expanded === String(open)
        ? undefined
        : `the trigger's aria-expanded is ${expanded}, the picker is ${open ? "open" : "closed"}`
    },
  },
  {
    name: "color-picker-format-controls",
    check: async ({ env }) => {
      const select = env.part("format-select")
      if (!(await select.exists())) return undefined
      const format = await env.part("root").attr("data-format")
      const value = await select.value()
      return value === format
        ? undefined
        : `the format select shows ${value}, the format is ${format}`
    },
  },
  {
    name: "color-picker-inline-is-not-a-layer",
    check: async ({ env }) => {
      if (!(await isInline(env))) return undefined
      const content = env.part("content")
      if (await content.isInert()) return "the inline content is inert"
      if ((await content.attr("aria-modal")) !== null) return "the inline content is aria-modal"
      return undefined
    },
  },
  {
    name: "color-picker-no-nan",
    check: async ({ env }) => {
      const style = (await env.part("root").attr("style")) ?? ""
      return style.includes("NaN") ? `the root style contains NaN: ${style}` : undefined
    },
  },
]

export const colorPickerContract = contract("color-picker", {
  machine: colorPickerMachine,
  anatomy: [
    "root",
    "label",
    "control",
    "trigger",
    "positioner",
    "content",
    "value-text",
    "value-swatch",
    "format-select",
    "format-trigger",
    "view",
    "eye-dropper-trigger",
    "hidden-input",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    open: {
      pointer: async (env) => env.part("trigger").click(),
      keyboard: async (env) => {
        await env.part("trigger").focusWithTab()
        await env.part("trigger").press("Enter")
      },
      // Placed, then focused (as Popover): before its placement the content ignores the pointer.
      done: async (env) =>
        ((await isOpen(env)) &&
          (await positioningQueries.isPlaced(env as never)) &&
          (await env.part("content").attr("data-focus-within")) !== null) ||
        (await env.part("trigger").attr("disabled")) !== null,
    },
    close: {
      keyboard: async (env) => env.keyboard("Escape"),
      done: async (env) => (await isInline(env)) || !(await isOpen(env)),
    },
    pressOutside: {
      pointer: async (env) => env.pointerOutside(),
      none: { keyboard: "an outside press is a pointer gesture; `close` is its keyboard twin" },
      done: async () => true,
    },
    tab: {
      keyboard: async (env) => env.keyboard("Tab"),
      done: async () => true,
    },
    shiftTab: {
      keyboard: async (env) => env.keyboard("Tab", { shift: true }),
      done: async () => true,
    },
    setFormat: {
      pointer: async (env, format: string) => {
        const select = env.part("format-select")
        if (await select.exists()) return select.fill(format)
        for (let i = 0; i < 4; i++) {
          if ((await env.part("root").attr("data-format")) === format) return
          await env.part("format-trigger").click()
        }
      },
      // The Format Trigger is the keyboard path (a native select's keys are the browser's).
      keyboard: async (env, format: string) => {
        for (let i = 0; i < 4; i++) {
          if ((await env.part("root").attr("data-format")) === format) return
          await env.part("format-trigger").press("Enter")
        }
      },
      done: async (env, format: string) => (await env.part("root").attr("data-format")) === format,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    color: async (env, format: ColorFormat = "hex") =>
      formatColor(parseColor(await cssColorOf(await env.part("root").attr("style"))), format),
    format: async (env) => (await env.part("root").attr("data-format")) ?? "",
    valueText: async (env, _driverOnly?: never) => env.part("value-text").text(),
    colorName: async (env, _driverOnly?: never) => {
      const label = (await env.part("trigger").attr("aria-label")) ?? ""
      return label.split(", ").slice(1).join(", ")
    },
    isOpen,
    isInline,
    formValue: async (env) => env.part("hidden-input").value(),
    closeReason: async (env, _driverOnly?: never) =>
      (await env.part("content").attr("data-close-reason")) ?? null,
    isEyeDropperAvailable: async (env, _driverOnly?: never) =>
      (await env.part("eye-dropper-trigger").exists()) &&
      (await env.part("eye-dropper-trigger").attr("hidden")) === null,
  },
  states: {
    closed: {},
    open: { isOpen: true },
  },
  events: {
    "TRIGGER.PRESS": {
      from: {
        closed: "open",
        open: { skip: "pressing the trigger of an open picker: the Popover's own contract" },
      },
    },
    OPEN: { skip: "the Popover's open request; walked through TRIGGER.PRESS" },
    CLOSE: { from: { open: "close", closed: { skip: "closed" } } },
    "COLOR.SET": { skip: "a child's change: the children's drivers and the scenarios" },
    "COLOR.COMMIT": { skip: "a child's commit: the children's drivers and the scenarios" },
    "FORMAT.SET": {
      from: {
        open: {
          action: "setFormat",
          args: (() => ["hsl"]) as never,
          event: () => ({ format: "hsl" }),
        },
        closed: { skip: "the format controls are in the content" },
      },
    },
    "EYEDROPPER.RESULT": { skip: "needs a fake EyeDropper: a scenario test" },
    RESET: {
      from: {
        closed: "resetForm",
        open: { skip: "a Reset button outside the content is an outside press: it closes first" },
      },
    },
    ADOPT: { skip: "autofill: a scenario test" },
    "VALUE.SYNCED": { skip: "the parent's prop change" },
    DISABLED: { skip: "disabled while open: a scenario test" },
    "$props:value": { skip: "the parent's prop change" },
    "$props:disabled": { skip: "a scenario test" },
    "$sync:open": { skip: "the parent's open prop: walked by the Popover's model" },
  },
  // Focus leaving the content closes a popover picker (the Field moves focus to the hidden
  // input to report validity).
  commitsOnFocus: [{ part: "hidden-input", state: "open" }],
  traits: ["form-associated", "field-associated"],
  invariants: colorPickerInvariants,
})
