import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { fieldMachine } from "./field.machine"

type P = "root" | "label" | "description" | "error-message"

const flag = async (env: Env<P>, attr: string) => (await env.part("root").attr(attr)) !== null

/** The control the Field's Label names. */
const control = (env: Env<P>) => env.part("label").labelled()

const ROLES_WITHOUT_INVALID = new Set(["button"])

/** Field invariants (spec "Field Invariants"), checked after every model-based step. */
export const fieldInvariants: readonly Invariant<P, string>[] = [
  {
    name: "field-invalid-agrees",
    check: async ({ env }) => {
      const c = control(env)
      if (!(await c.exists())) return undefined
      const invalid = await flag(env, "data-invalid")
      const role = (await c.attr("role")) ?? ""
      const aria = (await c.attr("aria-invalid")) === "true"
      if (!ROLES_WITHOUT_INVALID.has(role) && aria !== invalid) {
        return `the control's aria-invalid (${aria}) disagrees with the Field's data-invalid (${invalid})`
      }
      if (!invalid && (await env.part("error-message").count()) > 0) {
        return "an ErrorMessage is rendered while the Field does not display invalid"
      }
      return undefined
    },
  },
  {
    name: "field-describedby-rendered",
    check: async ({ env }) => {
      const c = control(env)
      if (!(await c.exists())) return undefined
      const list = await c.attr("aria-describedby")
      if (list === null) return undefined
      if (list.trim() === "") return "the control's aria-describedby is an empty string"
      for (const id of list.split(/\s+/)) {
        const parts = await Promise.all(
          (["description", "error-message"] as const).map(async (p) =>
            Promise.all((await env.part(p).all()).map((x) => x.attr("id"))),
          ),
        )
        const known = parts.flat()
        // Only Field parts are checked here; a control's own ids are its contract's.
        if (id.startsWith("field-") && !known.includes(id)) {
          return `aria-describedby lists "${id}", which is not a rendered Field part`
        }
      }
      return undefined
    },
  },
  {
    name: "field-error-described",
    check: async ({ env }) => {
      const c = control(env)
      if (!(await c.exists()) || !(await flag(env, "data-invalid"))) return undefined
      const listed = ((await c.attr("aria-describedby")) ?? "").split(/\s+/)
      for (const part of await env.part("error-message").all()) {
        const id = await part.attr("id")
        // The error must be in the description, not only in aria-errormessage (ark#4150).
        if (id && !listed.includes(id)) {
          return `the rendered ErrorMessage "${id}" is not in the control's aria-describedby`
        }
      }
      return undefined
    },
  },
  {
    name: "field-name-from-label",
    check: async ({ env }) => {
      const label = env.part("label")
      if (!(await label.exists())) return undefined
      const c = label.labelled()
      if (!(await c.exists())) return undefined
      const [name, text] = [await c.accessibleName(), await label.text()]
      return name === text
        ? undefined
        : `the control is named "${name}", not by its Label "${text}"`
    },
  },
  {
    name: "field-disabled-no-validity",
    check: async ({ env }) => {
      if (!(await flag(env, "data-disabled"))) return undefined
      return (await flag(env, "data-valid")) || (await flag(env, "data-invalid"))
        ? "a disabled Field carries data-valid or data-invalid"
        : undefined
    },
  },
]

/** The Field's contract (spec "Contract"): located by its Label's exact text. */
export const fieldContract = contract("field", {
  machine: fieldMachine,
  anatomy: ["root", "label", "description", "error-message"],
  locate: ({ label }: { readonly label: string | RegExp }) => ({ text: label }),
  actions: {
    focus: {
      pointer: async ({ part }) => part("label").click(),
      keyboard: async (env) => {
        const c = control(env)
        for (let i = 0; i < 50 && !(await c.isFocused()); i++) await env.keyboard("Tab")
      },
      done: async (env) => control(env).isFocused(),
    },
    blur: {
      pointer: async (env) => {
        const c = control(env)
        // Leaving needs focus inside first (an unfocused control has nothing to leave).
        if (!(await c.isFocused())) await c.focus()
        await env.pointerOutside()
      },
      keyboard: async (env) => {
        const c = control(env)
        if (!(await c.isFocused())) await c.focus()
        await env.keyboard("Tab")
      },
      done: { isTouched: true },
    },
    /** Types one character into the control (a text-entry control): CONTROL.CHANGE. */
    type: {
      keyboard: async (env) => control(env).type("x"),
      done: async () => true,
    },
  },
  queries: {
    isValid: async (env) => flag(env, "data-valid"),
    isInvalid: async (env) => flag(env, "data-invalid"),
    isValidating: async (env) => flag(env, "data-validating"),
    isTouched: async (env) => flag(env, "data-touched"),
    isDirty: async (env) => flag(env, "data-dirty"),
    isFilled: async (env) => flag(env, "data-filled"),
    isRequired: async (env) => flag(env, "data-required"),
    isDisabled: async (env) => flag(env, "data-disabled"),
    isReadOnly: async (env) => flag(env, "data-readonly"),
    errors: async ({ part }) =>
      Promise.all((await part("error-message").all()).map((p) => p.text())),
    description: async ({ part }) => {
      const d = part("description")
      return (await d.exists()) ? d.text() : null
    },
    label: async ({ part }) => {
      const l = part("label")
      return (await l.exists()) ? l.text() : null
    },
    controlName: async (env) => {
      const c = control(env)
      return (await c.exists()) ? c.accessibleName() : null
    },
    controlDescription: async (env) => {
      const c = control(env)
      return (await c.exists()) ? c.accessibleDescription() : null
    },
  },
  states: {
    idle: { isValid: false, isInvalid: false, isValidating: false },
    validating: { isValidating: true },
    valid: { isValid: true, isInvalid: false, isValidating: false },
    invalid: { isValid: false, isInvalid: true, isValidating: false },
  },
  events: {
    "CONTROL.REGISTER": { skip: "mount: the control registers when rendered" },
    "CONTROL.UNREGISTER": { skip: "unmount; covered by the browser tests" },
    // The action types one character: a user change the oracle validates like the page.
    "CONTROL.CHANGE": {
      action: "type",
      event: () => ({ value: "x", user: true, composing: false }),
    },
    "CONTROL.COMMIT": { skip: "Enter submits the form; covered by the browser tests" },
    "FOCUS.ENTER": "focus",
    "FOCUS.LEAVE": "blur",
    INVALID: { skip: "a form submission; covered by the browser tests" },
    "SUBMIT.ATTEMPT": { skip: "sent by Form (add-form)" },
    VALIDATED: { skip: "resolved by the validation effect" },
    "ERRORS.EXTERNAL": { skip: "taken through the $props:errors prop step" },
    "INVALID.PROP": { skip: "taken through the $props:invalid prop step" },
    "PROPS.CHANGE": {
      skip: "taken through the $props:disabled / $props:validationMode prop steps",
    },
    RESET: { skip: "a form reset; covered by the browser tests" },
    DECIDE: { skip: "internal: queued by every input event" },
    "$props:errors": { props: (target) => ({ errors: target === "invalid" ? ["Taken"] : [] }) },
    "$props:invalid": { props: (target) => ({ invalid: target === "invalid" }) },
    "$props:disabled": {
      skip: "a disabled Field cannot be focused or typed into, so a path cannot go on; covered by the browser tests",
    },
    "$props:validationMode": { props: () => ({ validationMode: "change" as const }) },
  },
  traits: [],
  invariants: fieldInvariants,
})
