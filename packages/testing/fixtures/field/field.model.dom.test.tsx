// Model-based tests: the Field contract with a FieldInput inside (tasks 7.1), and broken
// variants that must fail readably (7.2).
import { fieldContract, fieldMessages, mergeFieldProps, platforms } from "@rind-ui/core"
import { Field, mergeProps, RindProvider, useFieldControl } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { useId, useLayoutEffect, useRef } from "react"
import { describe, expect, it, vi } from "vitest"
import {
  type ConsumerInvariant,
  currentRun,
  domEnv,
  installAnnouncementLog,
  testMachine,
} from "../../src/index"
import { FieldInput } from "./field-input"

type RootProps = React.ComponentProps<typeof Field.Root>
type Loose = { [K in keyof RootProps]?: RootProps[K] | undefined }
// The oracle runs the real machine, so it needs every prop the machine reads.
const base = {
  // The oracle has no DOM: no registered control.
  control: () => null,
  messages: fieldMessages,
  label: () => "Email",
  formValues: () => ({}),
  invalid: undefined,
  disabled: undefined,
  errors: undefined,
  validationMode: "submit",
  validationBehavior: "native",
  validate: undefined,
  validationDebounce: undefined,
} as const

/** The Field props among the machine's (the oracle's extra props are not the component's). */
const rootProps = (p: Record<string, unknown>): RootProps => {
  const { messages: _m, label: _l, formValues: _f, control: _c, ...rest } = p
  return rest as RootProps
}

function ui(props: RootProps) {
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
      <form onSubmit={(e) => e.preventDefault()}>
        <Field.Root {...props}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.Description>Hint</Field.Description>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
      </form>
    </RindProvider>
  )
}

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

/**
 * Announcement invariant (spec "Field Invariants"): no announcement for a step that did not
 * change the displayed message, and each distinct displayed message is announced at most
 * once until it clears. Stateful: `reset()` between runs.
 */
function announcementInvariant() {
  let seen = 0
  let shown = ""
  const spoken = new Set<string>()
  const invariant: ConsumerInvariant<typeof fieldContract> = {
    name: "field-announcement-once-per-message",
    check: async ({ env }) => {
      const log = installAnnouncementLog()
      const added = log.slice(seen)
      seen = log.length
      const texts = await Promise.all((await env.part("error-message").all()).map((p) => p.text()))
      const now = texts.join(" ")
      const previous = shown
      shown = now
      if (now === "") spoken.clear()
      if (added.length === 0) return undefined
      if (now === previous) {
        return `announced "${added[0]?.message}" in a step that did not change the displayed message ("${now}")`
      }
      for (const a of added) {
        if (spoken.has(a.message))
          return `"${a.message}" was announced twice for one displayed error`
        spoken.add(a.message)
      }
      return undefined
    },
  }
  return {
    invariant,
    reset() {
      seen = 0
      shown = ""
      spoken.clear()
      installAnnouncementLog().length = 0
    },
  }
}
const announcements = announcementInvariant()

const inJsdom = navigator.userAgent.includes("jsdom")

/** jsdom does not focus a control when its label is activated by a virtual click. */
const test = (name: string, fn: () => Promise<void>) => {
  if (inJsdom && name.includes("FOCUS.ENTER") && name.includes("[virtual")) it.skip(name, fn)
  else it(name, fn)
}

function config(
  name: string,
  props: Loose,
  extra: Record<string, unknown> = {},
  contract = fieldContract,
  run = test,
) {
  describe(`field model: ${name}`, () => {
    testMachine(contract, {
      test: run,
      setup: () => {
        announcements.reset()
        return render(ui(props as RootProps))
      },
      rerender: (next, rendered) =>
        rendered.rerender(ui(rootProps(next as unknown as Record<string, unknown>))),
      target: () => screen,
      anchor: [{ label: "Email" }],
      props: { ...base, ...props } as never,
      a11y,
      invariants: [announcements.invariant],
      ...extra,
    })
  })
}

config("submit mode", { validationMode: "submit" })
config("blur mode", { validationMode: "blur" })
const reject = (v: unknown) => (v ? "Bad" : null)
config("change mode", { validationMode: "change", validate: reject })
config("blur mode, aria behaviour, required", {
  validationMode: "blur",
  validationBehavior: "aria",
  required: true,
  validate: reject,
})
config("change mode, aria behaviour", {
  validationMode: "change",
  validationBehavior: "aria",
  validate: reject,
})
config("submit mode, native required", { validationMode: "submit", required: true })

// A validate whose promise settles later than any test: the model stays in `validating`
// (VALIDATED is resolved by the effect, so the contract skips it). Settling, stale results
// and the debounce are covered with real promises in field.dom.test.tsx and the node tests.
config("change mode, async validate", {
  validationMode: "change",
  validate: () => new Promise<null>(() => {}),
})

// `invalid` and `errors` prop steps ($props:invalid, $props:errors) from each start.
config("prop steps, submit mode", { validationMode: "submit", invalid: undefined })
config("prop steps, change mode", {
  validationMode: "change",
  invalid: undefined,
  validate: reject,
})

// ---- 7.2: broken variants fail with a readable report naming the invariant ---------------

type Flaw =
  | "announce-each-key"
  | "aria-invalid-on-mount"
  | "error-only-in-errormessage"
  | "double-report"

/** A native-input control with one deliberate flaw (the registration is FieldInput's). */
function BrokenInput({ flaw }: { flaw: Flaw }) {
  const binding = useFieldControl()
  const id = useId()
  const own = binding?.controlId ?? id
  const el = useRef<HTMLInputElement | null>(null)
  const register = binding?.register
  useLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: own,
        labelable: true,
        focus: () => el.current?.focus(),
        validityElement: () => el.current,
        value: () => el.current?.value ?? "",
      },
      own,
    )
  }, [register, own])
  // The flawed binding hides the error id from the control (it stays in aria-errormessage).
  const hidden =
    flaw === "error-only-in-errormessage" && binding
      ? { ...binding, ids: { ...binding.ids, error: undefined } }
      : binding
  const field = mergeFieldProps({ role: "textbox", labelable: true }, hidden)
  const log = installAnnouncementLog()
  const props = mergeProps(
    {
      ...binding?.data,
      id: own,
      "aria-invalid": field["aria-invalid"],
      "aria-describedby": field["aria-describedby"],
      "aria-errormessage":
        flaw === "error-only-in-errormessage" && binding?.state.invalid
          ? binding.ids.error
          : undefined,
    },
    {
      ref: el,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const report = {
          type: "change",
          value: e.currentTarget.value,
          user: true,
          composing: false,
        } as const
        binding?.report(report)
        if (flaw === "double-report") binding?.report(report)
        // Broken: speaks on every key after the first, whether or not the message changed.
        if (flaw === "announce-each-key" && e.currentTarget.value.length > 1) {
          log.push({ message: "Email: Bad", priority: "polite" })
        }
      },
    },
    flaw === "aria-invalid-on-mount" ? { "aria-invalid": "true" as const } : {},
  )
  return <input {...props} />
}

/** Runs the model with `test` collecting instead of registering; returns each path's error. */
async function failuresOf(flaw: Flaw, props: Loose) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  const view = (p: Loose) => {
    announcements.reset()
    const log = installAnnouncementLog()
    return (
      <RindProvider
        announcer={{
          announce: (a) => {
            log.push(a)
          },
          prepare: () => () => {},
          cancel: () => {},
        }}
      >
        <form onSubmit={(e) => e.preventDefault()}>
          <Field.Root {...(p as RootProps)}>
            <Field.Label>Email</Field.Label>
            <BrokenInput flaw={flaw} />
            <Field.Description>Hint</Field.Description>
            <Field.ErrorMessage />
          </Field.Root>
          <button type="button">Next</button>
        </form>
      </RindProvider>
    )
  }
  testMachine(fieldContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(view(props)),
    rerender: (next, rendered) =>
      rendered.rerender(
        view({ ...props, ...rootProps(next as unknown as Record<string, unknown>) }),
      ),
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ label: "Email" }],
    props: { ...base, ...props } as never,
    invariants: [announcements.invariant],
    modalities: ["keyboard"],
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    document.body.innerHTML = ""
    out.push({ name: t.name, error })
  }
  return out
}

describe("broken Fields fail with the invariant's name", () => {
  const changeMode = { validationMode: "change", validate: reject } as const

  it("announces on every key: the second typing step names the announcement invariant", {
    timeout: 60_000,
  }, async () => {
    const results = await failuresOf("announce-each-key", changeMode)
    const failing = results.filter((r) => r.error?.includes("field-announcement-once-per-message"))
    expect(failing.length).toBeGreaterThan(0)
    // The first typing step alone is fine: only paths with a second change fail.
    expect(results.some((r) => r.error === null)).toBe(true)
  })

  it("aria-invalid on mount: names the aria-invalid agreement invariant", {
    timeout: 60_000,
  }, async () => {
    const results = await failuresOf("aria-invalid-on-mount", { validationMode: "submit" })
    expect(results.some((r) => r.error?.includes("field-invalid-agrees"))).toBe(true)
    expect(results.find((r) => r.error?.includes("field-invalid-agrees"))?.error).toContain(
      "aria-invalid",
    )
  })

  // The runner's `activations` count is polluted by its own replays (it re-types the keys
  // under IME composition and touch), so "validate runs once per change" cannot be stated
  // through testMachine: a correct control also evaluates 3 times in one `type` step. A
  // validate spy over one real change states it instead.
  it("validates twice per change: a validate spy sees the double report", async () => {
    const run = async (flaw: Flaw | null) => {
      const validate = vi.fn(reject)
      const { unmount } = render(
        <Field.Root validationMode="change" validate={validate}>
          <Field.Label>Email</Field.Label>
          {flaw ? <BrokenInput flaw={flaw} /> : <FieldInput />}
        </Field.Root>,
      )
      const atMount = validate.mock.calls.length
      await userEvent.type(screen.getByRole("textbox"), "x")
      unmount()
      return validate.mock.calls.length - atMount
    }
    expect(await run(null)).toBe(1)
    expect(await run("double-report")).toBe(2)
  })

  // The shipped `field-error-described` invariant requires the rendered error in aria-describedby
  // (an error only in aria-errormessage is not read by VoiceOver, ark#4150).
  it("error only in aria-errormessage: caught by the shipped invariants", {
    timeout: 60_000,
  }, async () => {
    const results = await failuresOf("error-only-in-errormessage", {
      validationMode: "change",
      validate: reject,
    })
    expect(results.some((r) => r.error !== null)).toBe(true)
  })
})
