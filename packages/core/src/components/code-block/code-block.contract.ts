import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type CodeBlockCopyState, codeBlockMachine } from "./code-block.machine"

type P =
  | "root"
  | "header"
  | "title"
  | "copy-trigger"
  | "wrap-trigger"
  | "collapse-trigger"
  | "content"
  | "code"
  | "line"
  | "description"

const copyState = async (env: Env<P>) =>
  ((await env.part("root").attr("data-copy-state")) ?? "idle") as CodeBlockCopyState
const isWrapped = async (env: Env<P>) => (await env.part("root").attr("data-wrapped")) !== null
const isExpanded = async (env: Env<P>) => (await env.part("root").attr("data-expanded")) !== null

/** Waits (advancing fake time when the test uses it) until the copy's write settled. */
const settled = async (env: Env<P>) => {
  for (let t = 0; t < 5000 && (await copyState(env)) === "copying"; t += 10) await env.advance(10)
}

const press = async (env: Env<P>, part: P, how: "pointer" | "touch" | "keyboard") => {
  const el = env.part(part)
  if (how === "pointer") await el.click()
  else if (how === "touch") await el.tap()
  else {
    await el.focus()
    await el.press("Enter")
  }
}

/**
 * Code Block's contract (spec "Code Block Contract"): located by the Title's text, or as the
 * only block in the target. The copy's result comes from the injected clipboard: `copy` starts
 * it, `settleCopy` waits for the write (COPY.DONE / COPY.FAILED: which one is the fake's choice).
 */
export const codeBlockContract = contract("code-block", {
  machine: codeBlockMachine,
  anatomy: [
    "root",
    "header",
    "title",
    "copy-trigger",
    "wrap-trigger",
    "collapse-trigger",
    "content",
    "code",
    "line",
    "description",
  ],
  locate: (anchor?: { readonly title: string | RegExp }) =>
    anchor ? { text: anchor.title } : { part: "root" },
  actions: {
    copy: {
      pointer: (env) => press(env, "copy-trigger", "pointer"),
      touch: (env) => press(env, "copy-trigger", "touch"),
      keyboard: (env) => press(env, "copy-trigger", "keyboard"),
      done: async (env) => (await copyState(env)) !== "idle",
    },
    settleCopy: {
      pointer: settled,
      touch: settled,
      keyboard: settled,
      done: async (env) => (await copyState(env)) !== "copying",
    },
    setWrapped: {
      pointer: async (env, on: boolean) => {
        if ((await isWrapped(env)) !== on) await press(env, "wrap-trigger", "pointer")
      },
      keyboard: async (env, on: boolean) => {
        if ((await isWrapped(env)) !== on) await press(env, "wrap-trigger", "keyboard")
      },
      done: async (env, on: boolean) => (await isWrapped(env)) === on,
    },
    setExpanded: {
      pointer: async (env, on: boolean) => {
        if ((await isExpanded(env)) !== on) await press(env, "collapse-trigger", "pointer")
      },
      keyboard: async (env, on: boolean) => {
        if ((await isExpanded(env)) !== on) await press(env, "collapse-trigger", "keyboard")
      },
      done: async (env, on: boolean) => (await isExpanded(env)) === on,
    },
  },
  queries: {
    /** The code's text without line numbers (as the adapters read text: whitespace collapsed). */
    text: async (env: Env<P>) => env.part("code").text(),
    lineCount: async (env: Env<P>) => env.part("line").count(),
    /** The `data-line` numbers of the highlighted lines. */
    highlightedLines: async (env: Env<P>) => {
      const lines = await env.part("line").all()
      const out: number[] = []
      for (const l of lines) {
        if ((await l.attr("data-highlighted")) !== null) out.push(Number(await l.attr("data-line")))
      }
      return out
    },
    isWrapped,
    isExpanded,
    isScrollable: async (env: Env<P>) => (await env.part("content").attr("tabindex")) === "0",
    copyState,
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
    "WRAP.TOGGLE": {
      action: "setWrapped",
      // The oracle's opposite value (the mapping's args type misses the action's own arguments).
      args: ((view: { values: { wrapped?: boolean } }) => [!view.values.wrapped]) as never,
    },
    "EXPAND.TOGGLE": {
      action: "setExpanded",
      args: ((view: { values: { expanded?: boolean } }) => [!view.values.expanded]) as never,
    },
    "OVERFLOW.CHANGE": { skip: "layout: the overflow browser tests" },
  },
  traits: [],
  // Not focus: the pending write settles by itself while the focus check waits.
  commitsOnFocus: (["copy-trigger", "wrap-trigger", "collapse-trigger", "content"] as const).map(
    (part) => ({ part, state: "copying" as const }),
  ),
})
