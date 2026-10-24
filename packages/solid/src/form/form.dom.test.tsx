/** @jsxImportSource solid-js */
// The Form contract model (React's configurations) against the Solid parts: Fields with a Text
// Field each, submit / change modes, native / aria behaviour, a held async check, a Field
// inserted above after mount, and server errors on a re-render; plus a submission and markup
// parity.
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
import { createSignal, For, onMount, Show } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Field, Form, type FormActions, RindProvider, TextField } from "../index"

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

function Story(props: { cfg: Config; errors?: FormErrors | undefined }) {
  let actions: FormActions | null = null
  const [count, setCount] = createSignal(0)
  const [ready, setReady] = createSignal(!props.cfg.late)
  onMount(() => setReady(true))
  const cfg = props.cfg
  const first = cfg.fields[0]?.name
  return (
    <Form.Root
      aria-label="Sign up"
      {...(cfg.mode ? { validationMode: cfg.mode } : {})}
      {...(cfg.behavior ? { validationBehavior: cfg.behavior } : {})}
      errors={props.errors}
      actionsRef={(a) => {
        actions = a
      }}
      onFormSubmit={() => setCount((c) => c + 1)}
      onReset={() => {
        serverErrors = {}
      }}
    >
      <For each={cfg.fields}>
        {(f) => (
          <Show when={f.name !== first || ready()}>
            <Field.Root
              name={f.name}
              required={f.required === true}
              {...(f.async
                ? { validate: (v: unknown) => (v ? new Promise<null>(() => {}) : null) }
                : {})}
            >
              <Field.Label>{f.name}</Field.Label>
              <TextField.Root defaultValue={f.value}>
                <TextField.Input />
              </TextField.Root>
              <Field.ErrorMessage />
            </Field.Root>
          </Show>
        )}
      </For>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      <button type="button" onClick={() => actions?.validate()}>
        Validate
      </button>
      <p>{`Submissions: ${count()}`}</p>
    </Form.Root>
  )
}

const ui = (cfg: Config) => (p: { errors?: FormErrors }) => {
  const log = installAnnouncementLog()
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      announcer={{
        announce: (a: never) => {
          log.push(a)
        },
        prepare: () => () => {},
        cancel: () => {},
      }}
    >
      <Story cfg={cfg} errors={p.errors} />
    </RindProvider>
  )
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
  describe(`solid form model: ${title}`, () => {
    let untrack = () => {}
    testMachine(formContract, {
      test: (n, fn) => it(n, { timeout: 30_000 }, fn),
      setup: () => {
        steps.reset()
        serverErrors = {}
        untrack()
        untrack = steps.track()
        return mount(ui(cfg), {})
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

describe("solid form with Field controls inside", () => {
  it("submits typed values; server errors by name show and the next change clears them", async () => {
    const submitted = vi.fn()
    const [errors, setErrors] = createSignal<FormErrors | undefined>(undefined)
    mount(() => (
      <Form.Root aria-label="Sign up" errors={errors()} onFormSubmit={submitted}>
        <Field.Root name="email">
          <Field.Label>Email</Field.Label>
          <TextField.Root defaultValue="a@b.co">
            <TextField.Input />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
        <button type="reset">Reset</button>
      </Form.Root>
    ))
    screen.getByRole("button", { name: "Send" }).click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
    expect(submitted.mock.calls[0]?.[0]).toEqual({ email: "a@b.co" })
    setErrors({ email: "Already taken" })
    await vi.waitFor(() => expect(screen.getByText("Already taken")).toBeTruthy())
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(screen.queryByText("Already taken")).toBeNull())
  })
})

describe("Solid Form matches React", () => {
  it("native and aria behaviour", async () => {
    for (const p of [
      { "aria-label": "Sign up" },
      { "aria-label": "Sign up", validationBehavior: "aria" },
    ]) {
      const react = r(R.Form.Root, p as never, r("button", { type: "submit" }, "Submit"))
      await clientParity(react, () => (
        <Form.Root {...(p as Record<string, unknown>)}>
          <button type="submit">Submit</button>
        </Form.Root>
      ))
    }
  })
})
