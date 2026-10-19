import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type ClipboardCopyState, clipboardMachine } from "./clipboard.machine"

type P = "root" | "label" | "control" | "input" | "trigger" | "indicator" | "value-text"
type E = Env<P>

const copyState = async (env: E) =>
  ((await env.part("root").attr("data-state")) ?? "idle") as ClipboardCopyState

/** Waits (advancing fake time when the test uses it) until the copy's write settled. */
const settled = async (env: E) => {
  for (let t = 0; t < 5000 && (await copyState(env)) === "copying"; t += 10) await env.advance(10)
}

const PARTS: readonly P[] = ["root", "control", "input", "trigger", "indicator", "value-text"]

/**
 * Clipboard invariants (spec "Clipboard Invariants"): every rendered part's `data-state` is the
 * root's, and the Indicator is hidden from assistive technology. The Trigger's stable name and
 * the announcement count are checked by the model test, which knows the step before.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "clipboard-state-on-every-part",
    check: async ({ env }) => {
      const state = await copyState(env)
      for (const part of PARTS) {
        for (const el of await env.part(part).all()) {
          const own = await el.attr("data-state")
          if (own !== state) return `${part} has data-state="${own}", the root "${state}"`
        }
      }
      return undefined
    },
  },
  {
    name: "clipboard-indicator-hidden",
    check: async ({ env }) => {
      for (const el of await env.part("indicator").all()) {
        if ((await el.attr("aria-hidden")) !== "true") return "the Indicator is not aria-hidden"
      }
      return undefined
    },
  },
]

/**
 * Clipboard's contract (spec "Clipboard Contract"): located by the Label's text, or as the only
 * Clipboard in the target. `copy` starts a write, `settleCopy` waits for it (COPY.DONE or
 * COPY.FAILED: which one is the fake clipboard's mode).
 */
export const clipboardContract = contract("clipboard", {
  machine: clipboardMachine,
  anatomy: ["root", "label", "control", "input", "trigger", "indicator", "value-text"],
  locate: (anchor?: { readonly label: string | RegExp }) =>
    anchor ? { text: anchor.label } : { part: "root" },
  actions: {
    copy: {
      pointer: (env) => env.part("trigger").click(),
      touch: (env) => env.part("trigger").tap(),
      keyboard: async (env) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Enter")
      },
      done: async (env) => (await copyState(env)) !== "idle",
    },
    settleCopy: {
      pointer: settled,
      touch: settled,
      keyboard: settled,
      done: async (env) => (await copyState(env)) !== "copying",
    },
    /** The whole value: the Input selects it on focus, then the user's copy. */
    copyFromInput: {
      pointer: async (env) => {
        await env.part("input").click()
        // A virtual (screen reader) click does not focus: the virtual cursor's focus selects.
        await env.part("input").focus()
        await env.part("input").copySelection()
      },
      keyboard: async (env) => {
        await env.part("input").focusWithTab()
        await env.part("input").copySelection()
      },
      done: async () => true,
    },
    /** The first `n` characters only (the user drag-selects them), then a copy. */
    copyPartOfInput: {
      pointer: async (env, n: number) => {
        const input = env.part("input")
        await input.click()
        await input.selectRange(0, n)
        await input.copySelection()
      },
      // Shift+Arrow selection is the browser's; the selection itself is set the same way.
      keyboard: async (env, n: number) => {
        const input = env.part("input")
        await input.focusWithTab()
        await input.selectRange(0, n)
        await input.copySelection()
      },
      done: async () => true,
    },
  },
  queries: {
    copyState,
    /** The ValueText's text, else the Input's value. */
    value: async (env: E) =>
      (await env.part("value-text").exists())
        ? env.part("value-text").text()
        : env.part("input").value(),
    inputValue: async (env: E) => env.part("input").value(),
    triggerName: async (env: E) => env.part("trigger").accessibleName(),
    isDisabled: async (env: E) => (await env.part("root").attr("data-disabled")) !== null,
  },
  states: {
    idle: { copyState: "idle" },
    copying: { copyState: "copying" },
    copied: { copyState: "copied" },
    error: { copyState: "error" },
  },
  events: {
    COPY: "copy",
    "COPY.DONE": "settleCopy",
    "COPY.FAILED": "settleCopy",
    // The driver's copy covers the whole value (a partial copy changes nothing: a DOM test).
    "INPUT.COPY": { action: "copyFromInput", event: () => ({ whole: true }) },
  },
  traits: [],
  invariants,
  // Not focus: the pending write settles by itself while the focus check waits.
  commitsOnFocus: (["trigger", "input"] as const).map((part) => ({
    part,
    state: "copying" as const,
  })),
})
