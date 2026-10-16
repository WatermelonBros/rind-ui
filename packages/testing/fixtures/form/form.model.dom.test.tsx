// Model-based tests: the Form contract over a story-like render with three Fields, one of
// them async (tasks 5.1), and broken variants that must fail readably (5.2).
import {
  type FormErrors,
  formContract,
  formMessages,
  PENDING_ANNOUNCEMENTS,
  platforms,
} from "@rind-ui/core"
import { Field, Form, type FormActions, RindProvider } from "@rind-ui/react"
import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useEffect, useRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import {
  currentRun,
  domEnv,
  formStepInvariants,
  installAnnouncementLog,
  testMachine,
} from "../../src/index"
import { FieldInput } from "../field/field-input"

interface Spec {
  readonly name: string
  readonly value: string
  readonly required?: boolean
  /** The check never settles: a submission stays held. */
  readonly async?: boolean
}
type Flaw = "registration-order-focus" | "focus-on-validate" | "announce-each-field"
interface Config {
  readonly fields: readonly Spec[]
  readonly mode?: "submit" | "blur" | "change"
  readonly behavior?: "native" | "aria"
  /** The first Field is inserted above the others after mount (base-ui#5284). */
  readonly late?: boolean
  readonly flaw?: Flaw
}

// ---- the story ---------------------------------------------------------------------------

/** What an attempt makes the oracle's fake Fields display (they have no DOM to read). */
let serverErrors: FormErrors = {}

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Story({
  cfg,
  errors,
}: {
  readonly cfg: Config
  readonly errors?: FormErrors | undefined
}) {
  const actions = useRef<FormActions>(null)
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState(!cfg.late)
  useEffect(() => setReady(true), [])
  const announce = (message: string) =>
    installAnnouncementLog().push({ message, priority: "polite" })
  const first = cfg.fields[0]?.name
  return (
    <Form.Root
      aria-label="Sign up"
      {...(cfg.mode ? { validationMode: cfg.mode } : {})}
      {...(cfg.behavior ? { validationBehavior: cfg.behavior } : {})}
      {...(errors ? { errors } : {})}
      actionsRef={actions}
      onFormSubmit={() => setCount((n) => n + 1)}
      onReset={() => {
        serverErrors = {}
      }}
      // Broken: every invalid control is announced by itself.
      onInvalidCapture={(e) => {
        if (cfg.flaw === "announce-each-field")
          announce(`${(e.target as HTMLInputElement).name}: invalid`)
      }}
    >
      {cfg.fields.map((f) =>
        f.name === first && !ready ? null : (
          <Field.Root
            key={f.name}
            name={f.name}
            {...(f.async
              ? { validate: (v: unknown) => (v ? new Promise<null>(() => {}) : null) }
              : {})}
          >
            <Field.Label>{f.name}</Field.Label>
            <FieldInput required={f.required === true} defaultValue={f.value} />
            <Field.ErrorMessage />
          </Field.Root>
        ),
      )}
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      <button
        type="button"
        onClick={() => {
          actions.current?.validate()
          // Broken: validate() also moves focus to the first invalid control.
          if (cfg.flaw === "focus-on-validate") {
            // fake-time: the app's deferred focus move under test; checks wait on conditions
            setTimeout(() => document.querySelector<HTMLElement>("input[aria-invalid]")?.focus(), 0)
          }
        }}
      >
        Validate
      </button>
      <p>Submissions: {count}</p>
      {cfg.flaw === "registration-order-focus" ? <OrderBreaker /> : null}
    </Form.Root>
  )
}

/** Broken: after the Form's own focus move, focuses the first Field that registered. */
function OrderBreaker() {
  useEffect(() => {
    const form = document.querySelector("form")
    if (!form) return
    const onInvalid = () =>
      // fake-time: the app's deferred focus move under test; checks wait on conditions
      setTimeout(() => {
        // The first mounted Field is the last one in the DOM when another was inserted above.
        const all = [...form.querySelectorAll<HTMLInputElement>("input[aria-invalid]")]
        all.at(-1)?.focus()
      }, 0)
    form.addEventListener("invalid", onInvalid, true)
    return () => form.removeEventListener("invalid", onInvalid, true)
  }, [])
  return null
}

function ui(cfg: Config, errors?: FormErrors) {
  const log = installAnnouncementLog()
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      announcer={{
        announce: (a) => {
          log.push(a)
        },
        prepare: () => () => {},
        cancel: () => {},
      }}
    >
      <Story cfg={cfg} errors={errors} />
    </RindProvider>
  )
}

// ---- the oracle's Fields ------------------------------------------------------------------

/** What each Field displays after an attempt, from the config and the server errors. */
function oracleFields(cfg: Config) {
  const names = cfg.late ? cfg.fields : cfg.fields
  return () =>
    names.map((f) => ({
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
}

const baseProps = (cfg: Config) => ({
  messages: formMessages,
  fields: oracleFields(cfg),
  requestSubmit: () => {},
  errors: undefined,
  onFormSubmit: undefined,
  validationMode: cfg.mode,
  validationBehavior: cfg.behavior,
})

// ---- the exported step invariants (form-focus-only-on-attempt, form-no-field-announcement) --

const steps = formStepInvariants()

// ---- 5.1: the model ------------------------------------------------------------------------

const email = (value: string): Spec => ({ name: "email", value, required: true })
const name = (value: string): Spec => ({ name: "name", value, required: true })
const username = (value: string): Spec => ({ name: "username", value, async: true })
const empty = [email(""), name(""), username("")]
const valid = [email("a@b.co"), name("Ada"), username("")]
const pending = [email("a@b.co"), name("Ada"), username("ada")]

function config(title: string, cfg: Config) {
  describe(`form model: ${title}`, () => {
    let untrack = () => {}
    testMachine(formContract, {
      test: (n, fn) => it(n, { timeout: 30_000 }, fn),
      setup: () => {
        steps.reset()
        serverErrors = {}
        untrack()
        untrack = steps.track()
        return render(ui(cfg))
      },
      rerender: (next, rendered) => {
        const errors = (next as unknown as { errors?: FormErrors }).errors
        serverErrors = errors ?? {}
        rendered.rerender(ui(cfg, errors))
      },
      target: () => screen,
      anchor: [{ name: "Sign up" }],
      props: baseProps(cfg) as never,
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

// ---- 5.2: broken variants fail with a readable report naming the invariant ------------------

/** Runs the model with `test` collecting instead of registering; returns each path's error. */
async function failuresOf(
  cfg: Config,
  modalities: readonly ("keyboard" | "pointer")[] = ["keyboard"],
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  const untrack = steps.track()
  testMachine(formContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      steps.reset()
      serverErrors = {}
      return render(ui(cfg))
    },
    rerender: (next, rendered) => {
      const errors = (next as unknown as { errors?: FormErrors }).errors
      serverErrors = errors ?? {}
      rendered.rerender(ui(cfg, errors))
    },
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ name: "Sign up" }],
    props: baseProps(cfg) as never,
    invariants: steps.invariants,
    modalities,
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    cleanup()
    out.push({ name: t.name, error })
  }
  untrack()
  // Announcements are debounced: let the ones this run queued be spoken before the next.
  await vi.waitFor(() =>
    expect((Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0).toBe(0),
  )
  return out
}

describe("broken Forms fail with the invariant's name", () => {
  it("focus by registration order: names form-focus-first-invalid", {
    timeout: 120_000,
  }, async () => {
    const results = await failuresOf({
      fields: empty,
      late: true,
      flaw: "registration-order-focus",
    })
    const failing = results.find((r) => r.error?.includes("form-focus-first-invalid"))
    expect(failing?.error).toContain("first invalid Field")
  })

  it("validate() moves focus: names form-focus-only-on-attempt", { timeout: 120_000 }, async () => {
    const results = await failuresOf({ fields: empty, flaw: "focus-on-validate" }, ["pointer"])
    expect(results.some((r) => r.error?.includes("form-focus-only-on-attempt"))).toBe(true)
  })

  it("a Field announces on submit: names form-no-field-announcement", {
    timeout: 120_000,
  }, async () => {
    const results = await failuresOf({ fields: empty, flaw: "announce-each-field" })
    expect(results.some((r) => r.error?.includes("form-no-field-announcement"))).toBe(true)
  })

  it("the unbroken story passes the same paths", { timeout: 120_000 }, async () => {
    const results = await failuresOf({ fields: empty, late: true })
    expect(results.filter((r) => r.error !== null)).toEqual([])
  })
})
