import { contract } from "@rind-ui/core"
import { counterMachine, toggleMachine } from "./press.machine"

export const toggleContract = contract("toggle", {
  machine: toggleMachine,
  anatomy: ["root"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    pressed: async (env) => (await env.part("root").attr("aria-pressed")) === "true",
  },
  actions: {
    press: {
      pointer: (env) => env.part("root").click(),
      keyboard: (env) => env.part("root").press("Space"),
      touch: (env) => env.part("root").tap(),
      done: async () => true,
    },
  },
  states: { on: { pressed: true }, off: { pressed: false } },
  dataState: { on: "on", off: "off" },
  attrs: { on: { root: { "aria-pressed": "true" } }, off: { root: { "aria-pressed": "false" } } },
  events: {
    PRESS: "press",
    "PRESS.START": { skip: "part of every press; observed through PRESS" },
    "PRESS.UP": { skip: "part of every press; observed through PRESS" },
    "PRESS.END": { skip: "part of every press; observed through PRESS" },
    "PRESS.CANCEL": { skip: "no state change" },
    LONG_PRESS: { skip: "the toggle does not opt into long press" },
    CONTEXT_MENU: { skip: "no state change" },
    FOCUS: { skip: "context only; covered by the focus invariants" },
    BLUR: { skip: "context only; covered by the focus invariants" },
    "$sync:pressed": { props: (target) => ({ pressed: target === "on" }) },
  },
  traits: [],
})

export const counterContract = contract("counter", {
  machine: counterMachine,
  anatomy: ["root"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    count: async (env) => Number(await env.part("root").attr("data-count")),
  },
  actions: {
    press: {
      pointer: (env) => env.part("root").click(),
      keyboard: (env) => env.part("root").press("Enter"),
      touch: (env) => env.part("root").tap(),
      done: async () => true,
    },
  },
  states: { idle: {} },
  events: {
    PRESS: "press",
    "PRESS.START": { skip: "part of every press; observed through PRESS" },
    "PRESS.UP": { skip: "part of every press; observed through PRESS" },
    "PRESS.END": { skip: "part of every press; observed through PRESS" },
    "PRESS.CANCEL": { skip: "no state change" },
    LONG_PRESS: { skip: "the counter does not opt into long press" },
    CONTEXT_MENU: { skip: "no state change" },
    FOCUS: { skip: "context only" },
    BLUR: { skip: "context only" },
  },
  traits: [],
})
