import { PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { Field, Form, type FormActions } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, useState } from "react"
import { createPortal } from "react-dom"
import { describe, expect, it, vi } from "vitest"
import { getForm, installAnnouncementLog } from "../../src/index"
import { FieldInput } from "../field/field-input"

function SignUp({
  onFormSubmit,
}: {
  readonly onFormSubmit: (v: Readonly<Record<string, unknown>>) => void
}) {
  return (
    <Form.Root aria-label="Sign up" onFormSubmit={onFormSubmit}>
      <Field.Root name="email">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Field.Root name="name">
        <Field.Label>Name</Field.Label>
        <FieldInput required />
        <Field.ErrorMessage />
      </Field.Root>
      <Field.Root name="city">
        <Field.Label>City</Field.Label>
        <FieldInput required />
        <Field.ErrorMessage />
      </Field.Root>
      <button type="submit">Submit</button>
    </Form.Root>
  )
}

describe("Form smoke", () => {
  it("failed attempt: one summary, first invalid focused; then values on submit", async () => {
    const log = installAnnouncementLog()
    log.length = 0
    const onFormSubmit = vi.fn()
    render(<SignUp onFormSubmit={onFormSubmit} />)
    const form = getForm(screen, { name: "Sign up" })
    await form.submit()
    await vi.waitFor(async () => expect(await form.isInvalid()).toBe(true))
    expect(await form.invalidFields()).toEqual(["email", "name", "city"])
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Email" }))
    await vi.waitFor(() => expect(log.map((a) => a.message)).toEqual(["3 fields have errors"]))
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "a@b.co")
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ada")
    await userEvent.type(screen.getByRole("textbox", { name: "City" }), "Rome")
    await form.submit()
    await vi.waitFor(() =>
      expect(onFormSubmit).toHaveBeenCalledWith(
        { email: "a@b.co", name: "Ada", city: "Rome" },
        expect.anything(),
      ),
    )
    expect(await form.isInvalid()).toBe(false)
  })
})

// ---- Scenarios of openspec form (tasks 4.2, 6.1) through FieldInput ------------------------

type Values = Readonly<Record<string, unknown>>
const box = (label: string) => screen.getByRole("textbox", { name: label }) as HTMLInputElement
const click = (name: string) => userEvent.click(screen.getByRole("button", { name }))
const rootOf = (label: string) => box(label).closest('[data-scope="field"]') as HTMLElement
const inJsdom = navigator.userAgent.includes("jsdom")
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const settle = () =>
  act(async () => {
    for (let i = 0; i < 4; i++) await frame()
  })
/** Waits until the announcer has nothing queued (debounce or frame), then asserts run. */
const announcerIdle = () =>
  vi.waitFor(() =>
    expect((Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0).toBe(0),
  )

const messages = () => installAnnouncementLog().map((a) => a.message)

function Item({
  name,
  label,
  ...control
}: { readonly name: string; readonly label?: string } & React.ComponentProps<typeof FieldInput>) {
  return (
    <Field.Root name={name}>
      <Field.Label>{label ?? name}</Field.Label>
      <FieldInput required {...control} />
      <Field.ErrorMessage />
    </Field.Root>
  )
}

function Buttons() {
  return (
    <>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </>
  )
}

describe("Form anatomy", () => {
  it("keeps native attributes; role form with the name", () => {
    render(
      <Form.Root action="/signup" method="post" aria-label="Sign up">
        <Item name="a" />
      </Form.Root>,
    )
    const form = screen.getByRole("form", { name: "Sign up" })
    expect(form.getAttribute("action")).toBe("/signup")
    expect(form.getAttribute("method")).toBe("post")
    expect(form.getAttribute("aria-label")).toBe("Sign up")
    expect(form.getAttribute("data-scope")).toBe("form")
    expect(form.getAttribute("data-part")).toBe("root")
  })

  it("no novalidate in native behaviour", () => {
    render(
      <Form.Root aria-label="F">
        <Item name="a" />
      </Form.Root>,
    )
    expect(screen.getByRole("form").hasAttribute("novalidate")).toBe(false)
  })

  it("novalidate in aria behaviour", () => {
    render(
      <Form.Root aria-label="F" validationBehavior="aria">
        <Item name="a" />
      </Form.Root>,
    )
    expect(screen.getByRole("form").hasAttribute("novalidate")).toBe(true)
  })
})

describe("Submit attempt", () => {
  it("tree order, not registration order, when a Field is inserted above (base-ui#5284)", async () => {
    function Page() {
      const [top, setTop] = useState(false)
      return (
        <Form.Root aria-label="F">
          {top ? <Item name="top" /> : null}
          <Item name="bottom" />
          <button type="button" onClick={() => setTop(true)}>
            Add
          </button>
          <Buttons />
        </Form.Root>
      )
    }
    render(<Page />)
    await click("Add")
    const form = getForm(screen, { name: "F" })
    await form.submit()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["top", "bottom"]))
    expect(await form.focusedField()).toBe("top")
    expect(document.activeElement).toBe(box("top"))
    expect(rootOf("top").hasAttribute("data-focus")).toBe(true)
  })

  it("no later focus theft: a Field added after a successful submit keeps focus (ariakit#6307)", async () => {
    const onFormSubmit = vi.fn()
    function Page() {
      const [extra, setExtra] = useState(false)
      return (
        <Form.Root aria-label="F" onFormSubmit={onFormSubmit}>
          <Item name="a" />
          {extra ? <Item name="late" /> : null}
          <button type="button" onClick={() => setExtra(true)}>
            Add
          </button>
          <Buttons />
        </Form.Root>
      )
    }
    render(<Page />)
    const form = getForm(screen, { name: "F" })
    await form.submit()
    await vi.waitFor(() => expect(document.activeElement).toBe(box("a")))
    await userEvent.type(box("a"), "x")
    await form.submit()
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1))
    const add = screen.getByRole("button", { name: "Add" })
    await userEvent.click(add)
    await settle()
    expect(box("late")).toBeTruthy()
    expect(document.activeElement).toBe(add)
  })

  it("a removed Field is ignored: no error, only mounted Fields validate (base-ui#2228)", async () => {
    function Page() {
      const [on, setOn] = useState(true)
      return (
        <Form.Root aria-label="F">
          {on ? <Item name="gone" /> : null}
          <Item name="kept" />
          <button type="button" onClick={() => setOn(false)}>
            Remove
          </button>
          <Buttons />
        </Form.Root>
      )
    }
    render(<Page />)
    await click("Remove")
    const form = getForm(screen, { name: "F" })
    await form.submit()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["kept"]))
    expect(await form.focusedField()).toBe("kept")
  })

  it("cross-field rule is validated again with the new values (radix#2566)", async () => {
    const onFormSubmit = vi.fn()
    render(
      <Form.Root aria-label="F" onFormSubmit={onFormSubmit}>
        <Field.Root name="password">
          <Field.Label>Password</Field.Label>
          <FieldInput />
        </Field.Root>
        <Field.Root
          name="confirm"
          validate={(v, values) => (v === values["password"] ? null : "Must match")}
        >
          <Field.Label>Confirm</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
        <Buttons />
      </Form.Root>,
    )
    const form = getForm(screen, { name: "F" })
    await userEvent.type(box("Password"), "abc")
    await userEvent.type(box("Confirm"), "abc")
    await form.submit()
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1))
    await userEvent.type(box("Password"), "d")
    await form.submit()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["confirm"]))
    expect(onFormSubmit).toHaveBeenCalledTimes(1)
  })

  it("programmatic validate() shows every error and moves no focus (ariakit#2397)", async () => {
    const actions = createRef<FormActions>()
    render(
      <Form.Root aria-label="F" actionsRef={actions}>
        <Item name="a" />
        <Item name="b" />
        <button type="button" onClick={() => actions.current?.validate()}>
          Validate
        </button>
        <Buttons />
      </Form.Root>,
    )
    const form = getForm(screen, { name: "F" })
    expect(await form.invalidFields()).toEqual([])
    await form.validate()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["a", "b"]))
    expect(await form.focusedField()).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Validate" }))
    expect(messages()).toEqual([])
    expect((await form.isInvalid()) && true).toBe(true)
  })

  it("validate(name) validates only that Field", async () => {
    const actions = createRef<FormActions>()
    render(
      <Form.Root aria-label="F" actionsRef={actions}>
        <Item name="a" />
        <Item name="b" />
      </Form.Root>,
    )
    act(() => actions.current?.validate("b"))
    await vi.waitFor(async () =>
      expect(await getForm(screen, { name: "F" }).invalidFields()).toEqual(["b"]),
    )
  })
})

describe("Values on submit", () => {
  it("strings from FieldInput, in tree order; the native submission is cancelled", async () => {
    const onFormSubmit = vi.fn()
    render(
      <Form.Root aria-label="F" onFormSubmit={onFormSubmit}>
        <Item name="email" />
        <Item name="city" />
        <Buttons />
      </Form.Root>,
    )
    await userEvent.type(box("email"), "a@b.co")
    await userEvent.type(box("city"), "Rome")
    await getForm(screen, { name: "F" }).submit()
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1))
    const [values, details] = onFormSubmit.mock.calls[0] ?? []
    expect(values).toEqual({ email: "a@b.co", city: "Rome" })
    expect(Object.keys(values)).toEqual(["email", "city"])
    expect(details.submitter).toBe(screen.getByRole("button", { name: "Submit" }))
    expect(details.event.defaultPrevented).toBe(true)
  })

  it.todo("a Checkbox `news` is true and a Checkbox Group `topics` is an array (add-checkbox)")
  it.todo("{ email, news: true, topics: ['ai','css'] } (add-checkbox-group)")
})

describe("Asynchronous validation holds the submission", () => {
  function Page({
    validate,
    onFormSubmit,
  }: {
    readonly validate: (v: unknown) => Promise<string | null>
    readonly onFormSubmit: (v: Values, d: { submitter: HTMLElement | null }) => void
  }) {
    return (
      <Form.Root aria-label="F" onFormSubmit={onFormSubmit}>
        <Field.Root name="username" validate={validate}>
          <Field.Label>Username</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Submit</button>
        <button type="submit">Save draft</button>
      </Form.Root>
    )
  }

  /** Holds a submission by the "Save draft" button, resolves valid, returns what was seen. */
  async function held() {
    let resolve: (r: string | null) => void = () => {}
    const validate = vi.fn(() => new Promise<string | null>((r) => (resolve = r)))
    const onFormSubmit = vi.fn()
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit")
    // What the submit event looks like once its dispatch is over; then swallowed, so a
    // submission that escaped cancellation does not navigate the test page away.
    const prevented: boolean[] = []
    const watch = (e: Event) => {
      prevented.push(e.defaultPrevented)
      e.preventDefault()
    }
    window.addEventListener("submit", watch)
    render(<Page validate={validate} onFormSubmit={onFormSubmit} />)
    const form = getForm(screen, { name: "F" })
    await userEvent.type(box("Username"), "ada")
    const draft = screen.getByRole("button", { name: "Save draft" })
    await userEvent.click(draft)
    await vi.waitFor(async () => expect(await form.isValidating()).toBe(true))
    expect(screen.getByRole("form").hasAttribute("data-validating")).toBe(true)
    // The Field also checks at mount, while typing and on blur: count from the held attempt.
    const before = validate.mock.calls.length
    await settle()
    expect(onFormSubmit).not.toHaveBeenCalled()
    await act(async () => resolve(null))
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1))
    await settle()
    window.removeEventListener("submit", watch)
    return {
      form,
      draft,
      onFormSubmit,
      requestSubmit,
      prevented,
      extraChecks: validate.mock.calls.length - before,
    }
  }

  // jsdom does not implement requestSubmit(): the resubmit only exists in real browsers.
  it.skipIf(inJsdom)(
    "one submission, with the same submitter, after the check resolves valid",
    async () => {
      const r = await held()
      expect(r.onFormSubmit).toHaveBeenCalledTimes(1)
      expect(r.onFormSubmit.mock.calls[0]?.[1].submitter).toBe(r.draft)
      expect(r.requestSubmit).toHaveBeenCalledWith(r.draft)
      // The resubmit reuses the settled result: the check does not run again.
      expect(r.extraChecks).toBe(0)
      expect(await r.form.isValidating()).toBe(false)
    },
  )

  // The resubmit is requested after the settling step, so the new submit is handled (and
  // replaced by onFormSubmit) while it is dispatched. jsdom has no requestSubmit().
  it.skipIf(inJsdom)("the resubmitted native submission is cancelled", async () => {
    const r = await held()
    expect(r.prevented).toEqual([true, true])
  })

  it("resolved invalid: no submission, the Field is focused and shows the error", async () => {
    let resolve: (r: string | null) => void = () => {}
    const validate = vi.fn(() => new Promise<string | null>((r) => (resolve = r)))
    const onFormSubmit = vi.fn()
    render(<Page validate={validate} onFormSubmit={onFormSubmit} />)
    const form = getForm(screen, { name: "F" })
    await userEvent.type(box("Username"), "ada")
    await userEvent.click(screen.getByRole("button", { name: "Submit" }))
    await vi.waitFor(async () => expect(await form.isValidating()).toBe(true))
    await act(async () => resolve("Taken"))
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["username"]))
    expect(document.activeElement).toBe(box("Username"))
    expect(onFormSubmit).not.toHaveBeenCalled()
  })
})

describe("Server errors", () => {
  function Page({ initial }: { readonly initial?: Record<string, string | string[]> }) {
    const [errors, setErrors] = useState(initial)
    return (
      <Form.Root
        aria-label="F"
        {...(errors ? { errors } : {})}
        onFormSubmit={() => setTimeout(() => setErrors({ email: "Already registered" }), 0)}
      >
        <Item name="city" />
        <Item name="email" />
        <Buttons />
      </Form.Root>
    )
  }

  it("errors returned after submit: shown, focused, natively invalid", async () => {
    render(<Page />)
    await userEvent.type(box("city"), "Rome")
    await userEvent.type(box("email"), "a@b.co")
    await getForm(screen, { name: "F" }).submit()
    await vi.waitFor(() => expect(screen.getByText("Already registered")).toBeTruthy())
    await vi.waitFor(() => expect(document.activeElement).toBe(box("email")))
    expect(box("email").validity.valid).toBe(false)
    expect(box("email").validationMessage).toBe("Already registered")
    expect(box("city").validity.valid).toBe(true)
    expect(await getForm(screen, { name: "F" }).focusedField()).toBe("email")
  })

  it("a nested name matches as a string (ariakit#3607)", () => {
    render(
      <Form.Root aria-label="F" errors={{ "items.0.name": "Required" }}>
        <Item name="items.0.name" label="Item name" />
        <Item name="items.1.name" label="Other" />
      </Form.Root>,
    )
    expect(rootOf("Item name").textContent).toContain("Required")
    expect(rootOf("Other").textContent).not.toContain("Required")
  })

  it("two Fields with one name both get the messages and each clears its own (radix#2380)", async () => {
    render(
      <Form.Root aria-label="F" errors={{ tag: "Bad tag" }}>
        <Item name="tag" label="One" />
        <Item name="tag" label="Two" />
      </Form.Root>,
    )
    expect(rootOf("One").textContent).toContain("Bad tag")
    expect(rootOf("Two").textContent).toContain("Bad tag")
    await userEvent.type(box("One"), "x")
    expect(rootOf("One").textContent).not.toContain("Bad tag")
    expect(rootOf("Two").textContent).toContain("Bad tag")
  })

  it("cleared by the Field's own change; other Fields' errors remain (base-ui#1745)", async () => {
    render(
      <Form.Root aria-label="F" errors={{ a: "A bad", b: "B bad" }}>
        <Item name="a" />
        <Item name="b" />
      </Form.Root>,
    )
    await userEvent.type(box("a"), "x")
    expect(rootOf("a").textContent).not.toContain("A bad")
    expect(rootOf("b").textContent).toContain("B bad")
  })

  it.todo(
    "a Radio Group `plan` server error clears when another plan is selected (add-radio-group)",
  )
})

describe("Failed attempt announcement", () => {
  it("three invalid Fields: one 'N fields have errors', no Field announcement", async () => {
    render(
      <Form.Root aria-label="F">
        <Item name="a" />
        <Item name="b" />
        <Item name="c" />
        <Buttons />
      </Form.Root>,
    )
    const form = getForm(screen, { name: "F" })
    await form.submit()
    await vi.waitFor(() => expect(messages()).toEqual(["3 fields have errors"]))
    await announcerIdle()
    expect(messages()).toEqual(["3 fields have errors"])
    expect(await form.announcements()).toEqual([
      expect.objectContaining({ message: "3 fields have errors" }),
    ])
    expect(document.activeElement).toBe(box("a"))
  })

  it("one invalid Field: nothing announced by Form or Field; the control is focused", async () => {
    render(
      <Form.Root aria-label="F">
        <Item name="a" />
        <Buttons />
      </Form.Root>,
    )
    await getForm(screen, { name: "F" }).submit()
    await vi.waitFor(() => expect(document.activeElement).toBe(box("a")))
    await announcerIdle()
    expect(messages()).toEqual([])
  })
})

describe("Reset", () => {
  function Page({ onReset }: { readonly onReset?: (e: React.FormEvent) => void }) {
    const [errors, setErrors] = useState<Record<string, string> | undefined>()
    return (
      <Form.Root
        aria-label="F"
        {...(errors ? { errors } : {})}
        onFormSubmit={() => setTimeout(() => setErrors({ b: "Server says no" }), 0)}
        {...(onReset ? { onReset } : {})}
      >
        <Item name="a" />
        <Item name="b" />
        <Buttons />
      </Form.Root>
    )
  }

  it("the reset button clears client and server errors, touched and dirty", async () => {
    render(<Page />)
    const form = getForm(screen, { name: "F" })
    await form.submit()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["a", "b"]))
    await userEvent.type(box("a"), "x")
    await userEvent.type(box("b"), "y")
    await form.submit()
    await vi.waitFor(() => expect(screen.getByText("Server says no")).toBeTruthy())
    await form.reset()
    await vi.waitFor(() => expect(screen.queryByText("Server says no")).toBeNull())
    expect(await form.invalidFields()).toEqual([])
    expect(await form.isInvalid()).toBe(false)
    for (const label of ["a", "b"]) {
      expect(rootOf(label).hasAttribute("data-touched")).toBe(false)
      expect(rootOf(label).hasAttribute("data-dirty")).toBe(false)
    }
    expect(box("a").value).toBe("")
  })

  it("a prevented reset keeps values, errors and flags (react-spectrum#7602)", async () => {
    render(<Page onReset={(e) => e.preventDefault()} />)
    const form = getForm(screen, { name: "F" })
    await userEvent.type(box("a"), "x")
    await form.submit()
    await vi.waitFor(async () => expect(await form.invalidFields()).toEqual(["b"]))
    await form.reset()
    await settle()
    expect(box("a").value).toBe("x")
    expect(await form.invalidFields()).toEqual(["b"])
    expect(await form.isInvalid()).toBe(true)
    expect(rootOf("a").hasAttribute("data-dirty")).toBe(true)
  })
})

describe("Nested forms", () => {
  it("an inner Form (in a Portal) keeps the default mode and validates only its Fields (react-spectrum#10740)", async () => {
    const reject = () => "Bad"
    render(
      <Form.Root aria-label="Outer" validationMode="change">
        <Item name="outer" />
        {createPortal(
          <Form.Root aria-label="Inner">
            <Field.Root name="inner" validate={reject}>
              <Field.Label>Inner field</Field.Label>
              <FieldInput />
              <Field.ErrorMessage />
            </Field.Root>
            <Buttons />
          </Form.Root>,
          document.body,
        )}
      </Form.Root>,
    )
    const inner = getForm(screen, { name: "Inner" })
    await userEvent.type(box("Inner field"), "x")
    await settle()
    // Submit mode: no error while typing (an inherited "change" would show "Bad" now).
    expect(await inner.invalidFields()).toEqual([])
    await inner.submit()
    await vi.waitFor(async () => expect(await inner.invalidFields()).toEqual(["inner"]))
    expect(await getForm(screen, { name: "Outer" }).invalidFields()).toEqual([])
    expect(rootOf("outer").hasAttribute("data-invalid")).toBe(false)
  })
})

describe("Data attributes", () => {
  it("data-invalid after a failure and cleared after a successful attempt", async () => {
    render(
      <Form.Root aria-label="F" onFormSubmit={() => {}}>
        <Item name="a" />
        <Buttons />
      </Form.Root>,
    )
    const root = screen.getByRole("form")
    const form = getForm(screen, { name: "F" })
    expect(root.hasAttribute("data-invalid")).toBe(false)
    await form.submit()
    await vi.waitFor(() => expect(root.hasAttribute("data-invalid")).toBe(true))
    await userEvent.type(box("a"), "x")
    await form.submit()
    await vi.waitFor(() => expect(root.hasAttribute("data-invalid")).toBe(false))
  })
})

describe("Native sequence", () => {
  it("Enter in a FieldInput: the invalid events are one attempt (one summary, first focused)", async () => {
    render(
      <Form.Root aria-label="F">
        <Item name="a" />
        <Item name="b" />
        <Item name="c" />
        <Buttons />
      </Form.Root>,
    )
    await userEvent.click(box("c"))
    await userEvent.keyboard("{Enter}")
    await vi.waitFor(() => expect(document.activeElement).toBe(box("a")))
    const summaries = () => messages().filter((m) => m.endsWith("fields have errors"))
    await vi.waitFor(() => expect(summaries()).toEqual(["3 fields have errors"]))
    await announcerIdle()
    expect(summaries()).toEqual(["3 fields have errors"])
    expect(await getForm(screen, { name: "F" }).invalidFields()).toEqual(["a", "b", "c"])
  })

  it("Enter in an invalid control: only the Form summary is announced", async () => {
    render(
      <Form.Root aria-label="F">
        <Item name="a" />
        <Item name="b" />
        <Item name="c" />
        <Buttons />
      </Form.Root>,
    )
    await userEvent.click(box("c"))
    await userEvent.keyboard("{Enter}")
    await vi.waitFor(() => expect(messages()).toContain("3 fields have errors"))
    await announcerIdle()
    expect(messages()).toEqual(["3 fields have errors"])
  })

  it.todo("Enter implicit submission from a Checkbox (add-checkbox)")
})

describe("a native-invalid control outside any Field", () => {
  it("blocks the submission: onFormSubmit is not called and the Form is invalid", async () => {
    const onFormSubmit = vi.fn()
    render(
      <Form.Root aria-label="Plain" onFormSubmit={onFormSubmit}>
        <input aria-label="Code" required />
        <button type="submit">Submit</button>
      </Form.Root>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Submit" }))
    const form = getForm(screen, { name: "Plain" })
    await vi.waitFor(async () => expect(await form.isInvalid()).toBe(true))
    expect(onFormSubmit).not.toHaveBeenCalled()
  })
})
