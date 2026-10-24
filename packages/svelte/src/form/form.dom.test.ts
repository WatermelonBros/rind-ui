// The Form contract model (React's configurations) against the Svelte parts: Fields with a Text
// Field each, submit / change modes, native / aria behaviour, a held async check, a Field
// inserted above after mount, and server errors on a re-render.
import { type FormErrors, formContract, formMessages } from "@rind-ui/core"
import { formStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import Story from "../../fixtures/form/story.svelte"
import { mount } from "../../fixtures/mount"

interface Spec {
  readonly name: string
  readonly value: string
  readonly required?: boolean
  /** The check never settles: a submission stays held. */
  readonly async?: boolean
}
interface Config {
  readonly fields: readonly Spec[]
  readonly mode?: "submit" | "blur" | "change"
  readonly behavior?: "native" | "aria"
  /** The first Field is inserted above the others after mount (base-ui#5284). */
  readonly late?: boolean
}
/** What an attempt makes the oracle's fake Fields display (they have no DOM to read). */
let serverErrors: FormErrors = {}
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

/** What each Field displays after an attempt, from the config and the server errors. */
const oracleFields = (cfg: Config) => () =>
  cfg.fields.map((f) => ({
    id: f.name,
    name: f.name,
    element: () => null,
    attempt: () => {},
    focus: () => {},
    value: () => f.value,
    status: () => {
      if (f.name in serverErrors) return "invalid" as const
      if (f.required && f.value === "") return "invalid" as const
      if (f.async && f.value !== "") return "validating" as const
      return "valid" as const
    },
  }))
const steps = formStepInvariants()
const email = (value: string): Spec => ({ name: "email", value, required: true })
const name = (value: string): Spec => ({ name: "name", value, required: true })
const username = (value: string): Spec => ({ name: "username", value, async: true })
const empty = [email(""), name(""), username("")]
const valid = [email("a@b.co"), name("Ada"), username("")]
const pending = [email("a@b.co"), name("Ada"), username("ada")]

function config(title: string, cfg: Config) {
  describe(`svelte form model: ${title}`, () => {
    let untrack = () => {}
    testMachine(formContract, {
      test: (n, fn) => it(n, { timeout: 30_000 }, fn),
      setup: () => {
        steps.reset()
        serverErrors = {}
        untrack()
        untrack = steps.track()
        return mount(Story, { cfg, onReset: () => (serverErrors = {}) } as never)
      },
      rerender: (next, rendered) => {
        const errors = (next as unknown as { errors?: FormErrors }).errors
        serverErrors = errors ?? {}
        return rendered.rerender({ cfg, errors, onReset: () => (serverErrors = {}) } as never)
      },
      target: () => screen,
      anchor: [{ name: "Sign up" }],
      props: {
        messages: formMessages,
        fields: oracleFields(cfg),
        requestSubmit: () => {},
        errors: undefined,
        onFormSubmit: undefined,
        validationMode: cfg.mode,
        validationBehavior: cfg.behavior,
      } as never,
      a11y,
      invariants: steps.invariants,
    })
  })
}
config("invalid Fields, submit mode", { fields: empty })
config("valid Fields, submit mode", { fields: valid })
config("pending async check holds", { fields: pending })
config("invalid Fields, change mode", { fields: empty, mode: "change" })
config("valid Fields, change mode", { fields: valid, mode: "change" })
config("invalid Fields, aria behaviour", { fields: empty, behavior: "aria" })
config("valid Fields, aria behaviour", { fields: valid, behavior: "aria" })
config("Field inserted above after mount", { fields: empty, late: true })
