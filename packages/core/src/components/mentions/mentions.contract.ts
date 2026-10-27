// Mentions' contract (spec "Mentions Contract"): typing goes through the textarea as a user
// types; the options are reached through the textarea's keys (active descendant).

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { mentionsMachine } from "./mentions.machine"

type P =
  | "root"
  | "textarea"
  | "description"
  | "highlighter"
  | "mention"
  | "positioner"
  | "popup"
  | "list"
  | "group"
  | "group-label"
  | "item"
  | "item-text"
  | "empty"
  | "loading"
type E = Env<P>

const isOpen = async (env: E) => (await env.part("textarea").attr("data-state")) === "open"

async function optionNamed(env: E, label: string | RegExp) {
  for (const o of await env.part("item").all()) {
    const t = await o.text()
    if (typeof label === "string" ? t === label : label.test(t)) return o
  }
  throw new Error(`no option "${String(label)}"`)
}

export const mentionsContract = contract("mentions", {
  machine: mentionsMachine,
  anatomy: [
    "root",
    "textarea",
    "description",
    "highlighter",
    "mention",
    "positioner",
    "popup",
    "list",
    "group",
    "group-label",
    "item",
    "item-text",
    "empty",
    "loading",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: ["textbox", "combobox"], name: anchor.name } : { part: "textarea" },
  actions: {
    type: {
      keyboard: async (env: E, text: string) => {
        await env.part("textarea").focus()
        await env.part("textarea").type(text)
      },
      none: { pointer: "typing is the keyboard's", touch: "typing is the keyboard's" },
      done: async () => true,
    },
    choose: {
      keyboard: async (env: E, label?: string | RegExp) => {
        if (label !== undefined) {
          for (let i = 0; i < 50; i++) {
            const active = await env.part("textarea").attr("aria-activedescendant")
            const target = await optionNamed(env, label)
            if (active !== null && active === (await target.attr("id"))) break
            await env.part("textarea").press("ArrowDown")
          }
        }
        await env.part("textarea").press("Enter")
      },
      pointer: async (env: E, label?: string | RegExp) =>
        (label === undefined ? env.part("item").nth(0) : await optionNamed(env, label)).click(),
      touch: async (env: E, label?: string | RegExp) =>
        (label === undefined ? env.part("item").nth(0) : await optionNamed(env, label)).tap(),
      done: async (env: E) => !(await isOpen(env)),
    },
    pressEscape: {
      keyboard: (env: E) => env.part("textarea").press("Escape"),
      none: { pointer: "Escape is a key", touch: "Escape is a key" },
      done: async (env: E) => !(await isOpen(env)),
    },
    backspace: {
      keyboard: (env: E) => env.part("textarea").press("Backspace"),
      none: { pointer: "Backspace is a key", touch: "Backspace is a key" },
      done: async () => true,
    },
  },
  queries: {
    isOpen,
    trigger: async (env: E) => (await env.part("textarea").attr("data-trigger")) ?? null,
    options: async (env: E) => {
      const out: string[] = []
      for (const o of await env.part("item").all()) out.push(await o.text())
      return out
    },
    value: async (env: E) => env.part("textarea").value(),
    mentions: async (env: E) => {
      const out: string[] = []
      for (const m of await env.part("mention").all()) out.push(await m.text())
      return out
    },
  },
  states: { closed: { isOpen: false }, open: { isOpen: true } },
  events: { "ITEM.CHOOSE": "choose", ESCAPE: "pressEscape" },
  traits: [],
})
