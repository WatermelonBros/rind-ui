// The Form contract model (React's configurations) against the Angular parts: Fields with a
// Text Field each, submit / change modes, native / aria behaviour, a held async check, a Field
// inserted above after mount, and server errors on a re-render.
import { afterNextRender, Component, input, signal } from "@angular/core"
import { type FormErrors, formContract, formMessages, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  currentRun,
  formStepInvariants,
  installAnnouncementLog,
  testMachine,
} from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Field } from "../field/field"
import { RindProvider } from "../provider"
import { TextField } from "../text-field/text-field"
import { Form } from "./form"

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
/** The configuration the next fixture renders. */
let current: Config = { fields: [] }
const held = (v: unknown) => (v ? new Promise<null>(() => {}) : null)

@Component({
  selector: "rind-f",
  imports: [RindProvider, Form, Field, TextField],
  template: `<ng-container rindProvider [environment]="env" [announcer]="announcer">
    <form
      rindFormRoot
      aria-label="Sign up"
      #f="rindFormRoot"
      [validationMode]="cfg.mode"
      [validationBehavior]="cfg.behavior"
      [errors]="errors()"
      [onFormSubmit]="submitted"
      (reset)="cleared()"
    >
      @for (s of cfg.fields; track s.name; let first = $first) {
        @if (!first || ready()) {
          <div rindFieldRoot [name]="s.name" [required]="s.required === true" [validate]="s.async ? held : undefined">
            <label rindFieldLabel>{{ s.name }}</label>
            <div rindTextFieldRoot [defaultValue]="s.value"><input rindTextFieldInput /></div>
            <div rindFieldErrorMessage></div>
          </div>
        }
      }
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      <button type="button" (click)="f.validate()">Validate</button>
      <p>Submissions: {{ count() }}</p>
    </form>
  </ng-container>`,
})
class Story {
  readonly errors = input<FormErrors | undefined>(undefined)
  readonly cfg = current
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly held = held
  readonly count = signal(0)
  readonly ready = signal(!current.late)
  private readonly log = installAnnouncementLog()
  readonly announcer = {
    announce: (a: never) => this.log.push(a),
    prepare: () => () => {},
    cancel: () => {},
  }
  readonly submitted = () => this.count.update((c) => c + 1)
  constructor() {
    afterNextRender(() => this.ready.set(true))
  }
  cleared() {
    serverErrors = {}
  }
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
  describe(`angular form model: ${title}`, () => {
    let untrack = () => {}
    testMachine(formContract, {
      test: (n, fn) => it(n, { timeout: 30_000 }, fn),
      setup: () => {
        steps.reset()
        serverErrors = {}
        untrack()
        untrack = steps.track()
        current = cfg
        return mount(Story)
      },
      rerender: (next, rendered) => {
        const errors = (next as unknown as { errors?: FormErrors }).errors
        serverErrors = errors ?? {}
        return rendered.rerender({ errors })
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

@Component({
  selector: "rind-f",
  imports: [Form],
  template: `<form rindFormRoot aria-label="Sign up" [validationBehavior]="behavior">
    <button type="submit">Submit</button>
  </form>`,
})
class Plain {
  readonly behavior = current.behavior
}

describe("Angular Form matches React", () => {
  it("native and aria behaviour", async () => {
    for (const behavior of [undefined, "aria"] as const) {
      current = { fields: [], ...(behavior ? { behavior } : {}) }
      const p = { "aria-label": "Sign up", ...(behavior ? { validationBehavior: behavior } : {}) }
      await both(r(R.Form.Root, p as never, r("button", { type: "submit" }, "Submit")), Plain)
    }
  })
})
