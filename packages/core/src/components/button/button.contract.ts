import { contract } from "../../contract/contract"
import { buttonMachine } from "./button.machine"

/** Button's contract (design §3). */
export const buttonContract = contract("button", {
  machine: buttonMachine,
  anatomy: ["root"],
  locate: ({
    name,
    role = "button",
  }: {
    readonly name: string | RegExp
    readonly role?: "button" | "link"
  }) => ({
    role,
    name,
  }),
  actions: {
    press: {
      pointer: async ({ part }) => part("root").click(),
      touch: async ({ part }) => part("root").tap(),
      keyboard: async ({ part }) => part("root").press("Enter"),
      // A press has no observable result on the Button itself: the test asserts its spy.
      done: async () => true,
    },
    pressWithSpace: {
      keyboard: async ({ part }) => part("root").press("Space"),
      done: async () => true,
    },
  },
  queries: {
    isDisabled: async ({ part }) =>
      (await part("root").attr("disabled")) !== null ||
      (await part("root").attr("aria-disabled")) === "true",
    isPending: async ({ part }) => (await part("root").attr("data-pending")) !== null,
    isFocused: async ({ part }) => part("root").isFocused(),
    isFocusVisible: async ({ part }) => (await part("root").attr("data-focus-visible")) !== null,
  },
  states: { idle: { isPending: false }, pending: { isPending: true } },
  dataState: { idle: "idle", pending: "pending" },
  events: {
    PRESS: "press",
    "PRESS.START": { skip: "part of every press; observed through PRESS" },
    "PRESS.UP": { skip: "part of every press; observed through PRESS" },
    "PRESS.END": { skip: "part of every press; observed through PRESS" },
    "PRESS.CANCEL": { skip: "no state change" },
    FOCUS: { skip: "context only; covered by the focus invariants" },
    BLUR: { skip: "context only; covered by the focus invariants" },
    "FIELDSET.CHANGE": { skip: "context only; covered by the fieldset tests" },
    "$sync:pending": { props: (target) => ({ pending: target === "pending" }) },
  },
  traits: [],
  // isFocused and isFocusVisible follow focus by definition: a programmatic focus changes
  // them and nothing else.
  commitsOnFocus: [
    { part: "root", state: "idle" },
    { part: "root", state: "pending" },
  ],
})
