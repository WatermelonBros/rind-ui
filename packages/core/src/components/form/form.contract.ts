import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { formMachine } from "./form.machine"

type P = "root"

const fieldRoots = (env: Env<P>) => env.part("root").scoped("field", "root").all()

/** Names of the Fields with this flag, in document order. */
const fieldsWith = async (env: Env<P>, flag: string) => {
  const out: string[] = []
  for (const f of await fieldRoots(env)) {
    if ((await f.attr(flag)) !== null) out.push((await f.attr("data-name")) ?? "")
  }
  return out
}

/** Form invariants (spec "Form Invariants"): focus after a failed attempt. */
export const formInvariants: readonly Invariant<P, string>[] = [
  {
    name: "form-focus-first-invalid",
    check: async ({ env }) => {
      if ((await env.part("root").attr("data-invalid")) === null) return undefined
      const invalid = await fieldsWith(env, "data-invalid")
      if (invalid.length === 0) return undefined
      const focused = await fieldsWith(env, "data-focus")
      // After a failed attempt focus is in the first invalid Field (until the user moves on).
      return focused.length > 0 && focused[0] !== invalid[0]
        ? `focus is in "${focused[0]}", not in the first invalid Field "${invalid[0]}"`
        : undefined
    },
  },
]

/** The Form's contract (spec "Contract"). */
export const formContract = contract("form", {
  machine: formMachine,
  anatomy: ["root"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "form", name }),
  actions: {
    submit: {
      pointer: async (env) => env.find({ role: "button", name: "Submit" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Submit" }).press("Enter"),
      done: async () => true,
    },
    reset: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
    validate: {
      // The story exposes the imperative handle as a "Validate" button.
      pointer: async (env) => env.find({ role: "button", name: "Validate" }).click(),
      none: { keyboard: "programmatic: validate() is called by code, not by a key" },
      done: async () => true,
    },
  },
  queries: {
    isInvalid: async ({ part }) => (await part("root").attr("data-invalid")) !== null,
    isValidating: async ({ part }) => (await part("root").attr("data-validating")) !== null,
    invalidFields: async (env) => fieldsWith(env, "data-invalid"),
    focusedField: async (env) => (await fieldsWith(env, "data-focus"))[0] ?? null,
    submissions: async (env) => {
      const counter = env.find({ text: /^Submissions: \d+$/ })
      return (await counter.exists()) ? Number((await counter.text()).split(": ")[1]) : 0
    },
  },
  states: {
    idle: { isValidating: false },
    validating: { isValidating: true },
    "awaiting-server": { isValidating: false, isInvalid: false },
  },
  events: {
    "SUBMIT.ATTEMPT": "submit",
    VALIDATE: "validate",
    "FIELD.SETTLED": { skip: "an async check settling; covered by the browser tests" },
    RESET: "reset",
    "ERRORS.PROP": { skip: "taken through the $props:errors prop step" },
    DECIDE: { skip: "internal: queued by every attempt" },
    "$props:errors": { props: () => ({ errors: { email: "Already registered" } }) },
  },
  traits: [],
  invariants: formInvariants,
})
