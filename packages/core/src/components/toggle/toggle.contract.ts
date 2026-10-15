import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { toggleMachine } from "./toggle.machine"

type P = "root" | "indicator"
// aria-pressed, never data-state (a composed part may write its own: radix#602).
const isOn = async (env: Env<P>) => (await env.part("root").attr("aria-pressed")) === "true"

/** The Toggle's contract (spec "Contract"). */
export const toggleContract = contract("toggle", {
  machine: toggleMachine,
  anatomy: ["root", "indicator"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "button", name }),
  actions: {
    setPressed: {
      pointer: async (env, pressed: boolean) => {
        if ((await isOn(env)) !== pressed) await env.part("root").click()
      },
      touch: async (env, pressed: boolean) => {
        if ((await isOn(env)) !== pressed) await env.part("root").tap()
      },
      keyboard: async (env, pressed: boolean) => {
        if ((await isOn(env)) !== pressed) await env.part("root").press("Space")
      },
      done: async (env, pressed: boolean) => (await isOn(env)) === pressed,
    },
    // Keyboard only: Enter activates a toggle button, unlike a checkbox (ark#2946).
    activateWithEnter: {
      keyboard: async (env, pressed: boolean) => {
        if ((await isOn(env)) !== pressed) await env.part("root").press("Enter")
      },
      done: async (env, pressed: boolean) => (await isOn(env)) === pressed,
    },
  },
  queries: {
    isPressed: isOn,
    isDisabled: async (env) => {
      const root = env.part("root")
      return (await root.attr("disabled")) !== null || (await root.attr("aria-disabled")) === "true"
    },
  },
  states: { off: { isPressed: false }, on: { isPressed: true } },
  dataState: { off: { root: "off", indicator: "off" }, on: { root: "on", indicator: "on" } },
  attrs: {
    off: { root: { "aria-pressed": "false" } },
    on: { root: { "aria-pressed": "true" } },
  },
  events: {
    // The opposite of the oracle's value (the mapping's args type misses the action's own
    // arguments, the same gap as text-field).
    PRESS: {
      action: "setPressed",
      args: ((view: { values: { pressed?: boolean } }) => [!view.values.pressed]) as never,
    },
    FOCUS: { skip: "focus alone changes no state (focus-does-not-commit is generic)" },
    BLUR: { skip: "blur changes no state" },
    "$sync:pressed": { props: (target) => ({ pressed: target === "on" }) },
  },
  traits: [],
})
