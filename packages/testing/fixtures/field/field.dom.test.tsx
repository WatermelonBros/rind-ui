// Field scenarios (openspec field, field-validation, field-control) through the FieldInput
// fixture, a native <input> implementing field-control. Runs in jsdom and in real browsers.
// Scenarios that need another control are todos naming the change that adds it.
import { Field, Fieldset, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { type ReactNode, StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getField, recordingAnnouncer, type Target } from "../../src/index"
import { FieldInput } from "./field-input"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type FormProps = {
  readonly children: ReactNode
  readonly onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  readonly onReset?: (e: React.FormEvent<HTMLFormElement>) => void
}
/** A plain <form>: no rind-ui Form. */
function Shell({ children, onSubmit, onReset }: FormProps) {
  return (
    <form
      data-testid="form"
      onSubmit={onSubmit ?? ((e) => e.preventDefault())}
      {...(onReset ? { onReset } : {})}
    >
      {children}
      <button type="submit">Send</button>
      <button type="reset">Clear</button>
    </form>
  )
}
const send = () => userEvent.click(screen.getByRole("button", { name: "Send" }))
const form = () => screen.getByTestId("form") as HTMLFormElement
const input = (name?: string) =>
  screen.getByRole("textbox", name ? { name } : undefined) as HTMLInputElement
const has = (el: Element, attr: string) => el.hasAttribute(attr)
const rootOf = (label: string) => screen.getByText(label).closest('[data-part="root"]') as Element
const idsOf = (el: Element, attr = "aria-describedby") =>
  (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)
/** Sets a value the way paste and autofill do: the native setter, then an input event. */
function pasteInto(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  act(() => {
    set?.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
/**
 * Renders `ui` without errors, then with them: external errors arrive by prop change, as
 * they do from a Form after a submission.
 */
async function renderThenErrors(ui: (errors?: readonly string[]) => ReactNode, errors: string[]) {
  const view = render(ui())
  await act(async () => view.rerender(ui(errors)))
  return view
}
const nextTick = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })

/** The composition test's control driver: a tiny stand-in until Text Field has its own. */
function getTextboxDriver(target: Target, anchor: { readonly name: string }) {
  const el = () => (target as typeof screen).getByRole("textbox", { name: anchor.name })
  return {
    fill: async (text: string) => {
      await userEvent.clear(el())
      await userEvent.type(el(), text)
    },
    element: el,
  }
}

describe("Field smoke", () => {
  it("labels, describes, submit mode shows the native error after submit, clears on fix", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit} noValidate={false}>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput type="email" required />
          <Field.Description>We never share it</Field.Description>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
      </form>,
    )
    const field = getField(screen, { label: "Email" })
    expect(await field.controlName()).toBe("Email")
    expect(await field.controlDescription()).toBe("We never share it")
    const el = screen.getByRole("textbox")
    await userEvent.type(el, "abc")
    await userEvent.tab()
    expect(await field.isInvalid()).toBe(false)
    expect(el.hasAttribute("aria-invalid")).toBe(false)
    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await field.isInvalid()).toBe(true)
    expect(el.getAttribute("aria-invalid")).toBe("true")
    expect((await field.errors()).length).toBe(1)
    expect(document.activeElement).toBe(el)
    await userEvent.type(el, "@x.io")
    expect(await field.isValid()).toBe(true)
    expect(await field.errors()).toEqual([])
    expect(el.getAttribute("aria-describedby")?.split(" ").length).toBe(1)
  })

  it("validate runs after native, in change mode with the new value", async () => {
    const validate = vi.fn((v: unknown) => (v === "taken" ? "Username taken" : null))
    render(
      <form>
        <Field.Root validationMode="change" validate={validate}>
          <Field.Label>User</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </form>,
    )
    const el = screen.getByRole("textbox") as HTMLInputElement
    await userEvent.type(el, "taken")
    expect(validate).toHaveBeenLastCalledWith("taken", expect.anything())
    const field = getField(screen, { label: "User" })
    expect(await field.errors()).toEqual(["Username taken"])
    expect(el.validationMessage).toBe("Username taken")
    expect(el.form?.checkValidity()).toBe(false)
    await act(async () => {
      await userEvent.type(el, "x")
    })
    expect(await field.isValid()).toBe(true)
    expect(el.validity.valid).toBe(true)
  })
})

describe("Field anatomy (field: Anatomy)", () => {
  it("Text Field in a Field: named, described, root without a role", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>We never share it</Field.Description>
      </Field.Root>,
    )
    const field = getField(screen, { label: "Email" })
    expect(await field.controlName()).toBe("Email")
    expect(await field.controlDescription()).toBe("We never share it")
    expect(await field.label()).toBe("Email")
    expect(await field.description()).toBe("We never share it")
    const root = rootOf("Email")
    expect(root.tagName).toBe("DIV")
    expect(has(root, "role")).toBe(false)
    expect(screen.getByText("Email").tagName).toBe("LABEL")
    expect(screen.getByText("We never share it").tagName).toBe("P")
    await a11y()
  })

  it("every part forwards its element's attributes and accepts substitution", () => {
    render(
      <Field.Root data-x="root" className="r">
        <Field.Label data-x="label" className="l">
          Email
        </Field.Label>
        <FieldInput />
        <Field.Description data-x="description" render={<div />}>
          Hint
        </Field.Description>
      </Field.Root>,
    )
    expect(rootOf("Email").getAttribute("data-x")).toBe("root")
    expect(rootOf("Email").className).toBe("r")
    expect(screen.getByText("Email").getAttribute("data-x")).toBe("label")
    expect(screen.getByText("Hint").tagName).toBe("DIV")
    expect(screen.getByText("Hint").getAttribute("data-x")).toBe("description")
  })

  it("clicking the Label focuses the control", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>,
    )
    await userEvent.click(screen.getByText("Email"))
    expect(document.activeElement).toBe(input())
  })

  it("a consumer id on the control is the one the Label points at", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput id="mine" />
      </Field.Root>,
    )
    expect(screen.getByText("Email").getAttribute("for")).toBe("mine")
    expect(await getField(screen, { label: "Email" }).controlName()).toBe("Email")
  })
})

describe("Error message content (field: Error Message Content)", () => {
  const tree = (
    <Shell>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage match="valueMissing">Enter your email</Field.ErrorMessage>
        <Field.ErrorMessage match="typeMismatch">That is not an email</Field.ErrorMessage>
      </Field.Root>
    </Shell>
  )

  it("one message per constraint: typeMismatch", async () => {
    render(tree)
    await userEvent.type(input(), "abc")
    await send()
    const field = getField(screen, { label: "Email" })
    expect(await field.errors()).toEqual(["That is not an email"])
    const message = screen.getByText("That is not an email")
    expect(idsOf(input())).toEqual([message.id])
    expect(screen.queryByText("Enter your email")).toBeNull()
  })

  it("one message per constraint: valueMissing", async () => {
    render(tree)
    await send()
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Enter your email"])
    expect(idsOf(input())).toEqual([screen.getByText("Enter your email").id])
  })

  it("the message switches with the cause while the error stays displayed", async () => {
    render(tree)
    await send()
    await userEvent.type(input(), "abc")
    const field = getField(screen, { label: "Email" })
    expect(await field.errors()).toEqual(["That is not an email"])
    await userEvent.type(input(), "@x.io")
    expect(await field.errors()).toEqual([])
  })

  it("the browser's validationMessage is the default text", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(await getField(screen, { label: "Email" }).errors()).toEqual([input().validationMessage])
    expect(input().validationMessage).not.toBe("")
  })

  it("several messages render as a list", async () => {
    await renderThenErrors(
      (errors) => (
        <Field.Root {...(errors ? { errors } : {})}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      ),
      ["One", "Two"],
    )
    const items = screen.getAllByRole("listitem")
    expect(items.map((i) => i.textContent)).toEqual(["One", "Two"])
  })

  it("children replace the default text", async () => {
    render(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Custom words</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Custom words"])
  })

  it("children that render nothing fall back to the server error (react-spectrum#7034)", async () => {
    await renderThenErrors(
      (errors) => (
        <Field.Root {...(errors ? { errors } : {})}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage>{() => null}</Field.ErrorMessage>
        </Field.Root>
      ),
      ["Server says no"],
    )
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Server says no"])
  })

  it("children as a function receive the messages", async () => {
    await renderThenErrors(
      (errors) => (
        <Field.Root {...(errors ? { errors } : {})}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage>{(m) => `${m.length} problems`}</Field.ErrorMessage>
        </Field.Root>
      ),
      ["a", "b"],
    )
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["2 problems"])
  })

  it("the control keeps focus and stays the same element when the error appears (react-spectrum#2681)", async () => {
    render(
      <Field.Root validationMode="change" validate={(v) => (v ? "Nope" : null)}>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>,
    )
    const before = input()
    await userEvent.type(before, "a")
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
    expect(input()).toBe(before)
    expect(document.activeElement).toBe(before)
  })
})

describe("Data attributes (field: Data Attributes)", () => {
  it("scope, part and instance on every part, the control's own validation attributes too", async () => {
    render(
      <Shell>
        <Field.Root required>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.Description>Hint</Field.Description>
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    const root = rootOf("Email")
    const instance = root.getAttribute("data-instance")
    expect(instance).toBeTruthy()
    for (const [text, part] of [
      ["Email", "label"],
      ["Hint", "description"],
    ] as const) {
      const el = screen.getByText(text)
      expect(el.getAttribute("data-scope")).toBe("field")
      expect(el.getAttribute("data-part")).toBe(part)
      expect(el.getAttribute("data-instance")).toBe(instance)
    }
    expect(root.getAttribute("data-scope")).toBe("field")
    // Before a validation result is displayed: neither valid nor invalid, anywhere.
    for (const el of [root, screen.getByText("Email"), screen.getByText("Hint"), input()]) {
      expect(has(el, "data-valid")).toBe(false)
      expect(has(el, "data-invalid")).toBe(false)
    }
    expect(has(root, "data-required")).toBe(true)
    await send()
    const message = screen.getByText(input().validationMessage)
    expect(message.getAttribute("data-part")).toBe("error-message")
    for (const el of [
      root,
      screen.getByText("Email"),
      screen.getByText("Hint"),
      input(),
      message,
    ]) {
      expect(has(el, "data-invalid")).toBe(true)
      expect(has(el, "data-valid")).toBe(false)
    }
  })

  it("valid after a corrected value; touched, dirty and filled on every part", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.Description>Hint</Field.Description>
        </Field.Root>
      </Shell>,
    )
    const parts = () => [
      rootOf("Email"),
      screen.getByText("Email"),
      screen.getByText("Hint"),
      input(),
    ]
    for (const el of parts()) {
      expect(has(el, "data-touched")).toBe(false)
      expect(has(el, "data-dirty")).toBe(false)
      expect(has(el, "data-filled")).toBe(false)
    }
    await send()
    await userEvent.type(input(), "a")
    await userEvent.tab()
    for (const el of parts()) {
      expect(has(el, "data-valid")).toBe(true)
      expect(has(el, "data-touched")).toBe(true)
      expect(has(el, "data-dirty")).toBe(true)
      expect(has(el, "data-filled")).toBe(true)
    }
  })

  it("disabled, read-only and required reach the parts and the control", () => {
    render(
      <Field.Root disabled readOnly required>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>Hint</Field.Description>
      </Field.Root>,
    )
    for (const attr of ["data-disabled", "data-readonly", "data-required"]) {
      for (const el of [rootOf("Email"), screen.getByText("Email"), screen.getByText("Hint")]) {
        expect(has(el, attr)).toBe(true)
      }
    }
    const el = screen.getByLabelText("Email") as HTMLInputElement
    expect(el.disabled).toBe(true)
    expect(el.readOnly).toBe(true)
    expect(el.required).toBe(true)
  })

  it("the touched and dirty props are controlled", () => {
    render(
      <Field.Root touched dirty>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>,
    )
    expect(has(rootOf("Email"), "data-touched")).toBe(true)
    expect(has(rootOf("Email"), "data-dirty")).toBe(true)
  })

  it("touched only after focus has left", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>
      </Shell>,
    )
    const field = getField(screen, { label: "Email" })
    await userEvent.click(input())
    expect(await field.isTouched()).toBe(false)
    await userEvent.tab()
    expect(await field.isTouched()).toBe(true)
  })

  it("the Field focus and blur actions (keyboard) set touched (contract postcondition)", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>
      </Shell>,
    )
    const field = getField(screen, { label: "Email" })
    await field.via("keyboard").focus()
    expect(document.activeElement).toBe(input())
    await field.via("keyboard").blur()
    expect(await field.isTouched()).toBe(true)
  })

  // Contract: blur by pointer is "press outside every layer": a click on the page background
  // blurs with relatedTarget null; the Field checks document.hasFocus() after a tick.
  it("the Field blur action by pointer sets touched", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>
      </Shell>,
    )
    const field = getField(screen, { label: "Email" })
    await field.via("keyboard").focus()
    await field.via("pointer").blur()
    expect(await field.isTouched()).toBe(true)
  })

  it("dirty goes back to false when the original text is restored", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput defaultValue="hello" />
      </Field.Root>,
    )
    const field = getField(screen, { label: "Email" })
    expect(await field.isDirty()).toBe(false)
    expect(await field.isFilled()).toBe(true)
    await userEvent.type(input(), "!")
    expect(await field.isDirty()).toBe(true)
    await userEvent.type(input(), "{Backspace}")
    expect(await field.isDirty()).toBe(false)
  })

  it("filled follows the value", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>,
    )
    const field = getField(screen, { label: "Email" })
    expect(await field.isFilled()).toBe(false)
    await userEvent.type(input(), "a")
    expect(await field.isFilled()).toBe(true)
    await userEvent.clear(input())
    expect(await field.isFilled()).toBe(false)
  })
})

describe("Messages (field: Messages)", () => {
  it("localised constraint message: ErrorMessage text and native validationMessage", async () => {
    render(
      <Shell>
        <Field.Root messages={{ valueMissing: "Campo obbligatorio" }}>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Campo obbligatorio"])
    expect(input().validationMessage).toBe("Campo obbligatorio")
  })

  it("the provider's messages reach the Field", async () => {
    render(
      <RindProvider messages={{ field: { valueMissing: "Obligatoire" } }}>
        <Shell>
          <Field.Root>
            <Field.Label>Email</Field.Label>
            <FieldInput required />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>
      </RindProvider>,
    )
    await send()
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Obligatoire"])
  })
})

describe("Contract and driver composition (field: Contract)", () => {
  it("getField(...).control(getX) returns the control's driver located inside the Field", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput type="email" />
          <Field.ErrorMessage />
        </Field.Root>
        <Field.Root>
          <Field.Label>Other</Field.Label>
          <FieldInput />
        </Field.Root>
      </Shell>,
    )
    const email = getField(screen, { label: "Email" })
    const control = email.control(getTextboxDriver)
    expect(control.element()).toBe(screen.getByLabelText("Email"))
    await control.fill("a@")
    await send()
    expect(await email.isInvalid()).toBe(true)
    expect(await email.errors()).toEqual([input("Email").validationMessage])
    expect(await getField(screen, { label: "Other" }).isInvalid()).toBe(false)
  })

  it("queries: required, disabled, read-only, controlName and controlDescription", async () => {
    render(
      <Field.Root required readOnly>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>Hint</Field.Description>
      </Field.Root>,
    )
    const f = getField(screen, { label: "Email" })
    expect(await f.isRequired()).toBe(true)
    expect(await f.isReadOnly()).toBe(true)
    expect(await f.isDisabled()).toBe(false)
    expect(await f.controlName()).toBe("Email")
    expect(await f.controlDescription()).toBe("Hint")
  })
})

describe("Sources and native validity (field-validation)", () => {
  it("native before custom: only the required message is shown and validate has not run (base-ui#1904)", async () => {
    const validate = vi.fn(() => "Custom")
    render(
      <Shell>
        <Field.Root validate={validate}>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(await getField(screen, { label: "Email" }).errors()).toEqual([input().validationMessage])
    expect(input().validationMessage).not.toBe("Custom")
    expect(validate).not.toHaveBeenCalled()
  })

  it("a control-owned validity message counts as native and beats validate", async () => {
    const validate = vi.fn(() => "Custom")
    render(
      <Shell>
        <Field.Root validate={validate}>
          <Field.Label>Date</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    validate.mockClear()
    // The control sets its own message on its validity element (Date Field's badInput).
    input().setCustomValidity("Enter a real date")
    await send()
    expect(await getField(screen, { label: "Date" }).errors()).toEqual(["Enter a real date"])
    expect(validate).not.toHaveBeenCalled()
  })

  it("checkValidity agrees with the Field (kobalte#473), before anything is displayed", async () => {
    render(
      <Shell>
        <Field.Root validate={(v) => (v === "bob" ? "Username taken" : null)}>
          <Field.Label>User</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await userEvent.type(input(), "bob")
    // Submit mode: nothing displayed, but native validity already knows.
    expect(await getField(screen, { label: "User" }).isInvalid()).toBe(false)
    expect(form().checkValidity()).toBe(false)
    expect(input().validationMessage).toBe("Username taken")
  })

  it("custom validity is cleared once the value passes validate", async () => {
    render(
      <Shell>
        <Field.Root
          validationMode="change"
          validate={(v) => (v === "bob" ? "Username taken" : null)}
        >
          <Field.Label>User</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await userEvent.type(input(), "bob")
    expect(input().validity.customError).toBe(true)
    await userEvent.type(input(), "by")
    expect(input().validity.valid).toBe(true)
    expect(input().validationMessage).toBe("")
    expect(form().checkValidity()).toBe(true)
  })

  it("invalid={true} forces the error; back to undefined shows nothing until validated (base-ui#3777)", async () => {
    const ui = (invalid?: boolean) => (
      <Shell>
        <Field.Root {...(invalid === undefined ? {} : { invalid })} validationMode="change">
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage>Bad</Field.ErrorMessage>
        </Field.Root>
      </Shell>
    )
    const { rerender } = render(ui(true))
    const f = getField(screen, { label: "Email" })
    expect(await f.isInvalid()).toBe(true)
    expect(input().getAttribute("aria-invalid")).toBe("true")
    await act(async () => rerender(ui(undefined)))
    expect(await f.isInvalid()).toBe(false)
    expect(await f.isValid()).toBe(false)
    expect(await f.errors()).toEqual([])
    await userEvent.type(input(), "x")
    expect(await f.isValid()).toBe(true)
    await act(async () => rerender(ui(true)))
    await act(async () => rerender(ui(false)))
    expect(await f.isValid()).toBe(true)
    expect(has(input(), "aria-invalid")).toBe(false)
  })

  it("disabled: the ErrorMessage goes, aria-invalid goes, neither data-valid nor data-invalid", async () => {
    const ui = (disabled: boolean) => (
      <Field.Root invalid disabled={disabled}>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Bad</Field.ErrorMessage>
      </Field.Root>
    )
    const { rerender } = render(ui(false))
    expect(screen.getByText("Bad")).toBeTruthy()
    await act(async () => rerender(ui(true)))
    await vi.waitFor(() => expect(screen.queryByText("Bad")).toBeNull())
    expect(has(input(), "aria-invalid")).toBe(false)
    expect(has(rootOf("Email"), "data-valid")).toBe(false)
    expect(has(rootOf("Email"), "data-invalid")).toBe(false)
  })

  it("a Field inside a disabled Fieldset is disabled", () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>
      </Fieldset.Root>,
    )
    expect(input().disabled).toBe(true)
    expect(has(rootOf("Email"), "data-disabled")).toBe(true)
    expect(has(screen.getByText("Email"), "data-disabled")).toBe(true)
  })
})

describe("Validation mode (field-validation)", () => {
  const ui = (props: Partial<React.ComponentProps<typeof Field.Root>> = {}) => (
    <Shell>
      <Field.Root {...props}>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" />
        <Field.ErrorMessage />
      </Field.Root>
    </Shell>
  )

  it("the default mode is quiet until submit (base-ui#2142)", async () => {
    render(ui())
    await userEvent.type(input(), "abc")
    await userEvent.tab()
    expect(has(input(), "aria-invalid")).toBe(false)
    expect(await getField(screen, { label: "Email" }).errors()).toEqual([])
    await send()
    expect(input().getAttribute("aria-invalid")).toBe("true")
    expect((await getField(screen, { label: "Email" }).errors()).length).toBe(1)
  })

  it("the error clears with the keystroke that makes the value valid (react-spectrum#6983)", async () => {
    render(ui())
    await userEvent.type(input(), "abc@")
    await send()
    const f = getField(screen, { label: "Email" })
    expect(await f.isInvalid()).toBe(true)
    await userEvent.type(input(), "x")
    expect(input().validity.valid).toBe(true)
    expect(await f.isInvalid()).toBe(false)
    expect(await f.isValid()).toBe(true)
    expect(await f.errors()).toEqual([])
  })

  it("blur mode: shown when focus leaves after a change, then on every change", async () => {
    render(ui({ validationMode: "blur" }))
    const f = getField(screen, { label: "Email" })
    await userEvent.type(input(), "abc")
    expect(await f.isInvalid()).toBe(false)
    await userEvent.tab()
    expect(await f.isInvalid()).toBe(true)
    await userEvent.type(input(), "@x")
    expect(await f.isValid()).toBe(true)
  })

  it("blur mode: tabbing through an empty required field shows nothing; a submit attempt shows it (base-ui#1425)", async () => {
    render(
      <Shell>
        <Field.Root validationMode="blur" required>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    const f = getField(screen, { label: "Email" })
    await userEvent.tab()
    expect(document.activeElement).toBe(input())
    await userEvent.tab()
    await userEvent.tab({ shift: true })
    await userEvent.tab()
    expect(await f.isTouched()).toBe(true)
    expect(await f.isInvalid()).toBe(false)
    await send()
    expect(await f.isInvalid()).toBe(true)
  })

  it("change mode: shown on every change", async () => {
    render(ui({ validationMode: "change" }))
    const f = getField(screen, { label: "Email" })
    await userEvent.type(input(), "a")
    expect(await f.isInvalid()).toBe(true)
    await userEvent.type(input(), "@b")
    expect(await f.isValid()).toBe(true)
  })

  it("the mode is a prop: switching it takes effect", async () => {
    const { rerender } = render(ui())
    await userEvent.type(input(), "a")
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(false)
    await act(async () => rerender(ui({ validationMode: "change" })))
    await userEvent.type(input(), "b")
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
  })

  it("a controlled value fixed by the parent clears the error and the next submit succeeds (react-spectrum#8659)", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    function Controlled() {
      const [value, setValue] = useState("")
      return (
        <Shell onSubmit={onSubmit}>
          <Field.Root validationMode="change" validate={(v) => (v === "ok" ? null : "Must be ok")}>
            <Field.Label>Code</Field.Label>
            <FieldInput value={value} onChange={(e) => setValue(e.currentTarget.value)} />
            <Field.ErrorMessage />
          </Field.Root>
          <button type="button" onClick={() => setValue("ok")}>
            Fix it
          </button>
        </Shell>
      )
    }
    render(<Controlled />)
    const f = getField(screen, { label: "Code" })
    await userEvent.type(input(), "no")
    expect(await f.isInvalid()).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: "Fix it" }))
    expect(input().value).toBe("ok")
    expect(await f.isInvalid()).toBe(false)
    expect(await f.isValid()).toBe(true)
    expect(await f.errors()).toEqual([])
    await send()
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it("paste and autofill after a submit attempt revalidate (radix#2542)", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    const f = getField(screen, { label: "Email" })
    await send()
    expect(await f.isInvalid()).toBe(true)
    pasteInto(input(), "pasted@x.io")
    expect(await f.isInvalid()).toBe(false)
    expect(await f.isValid()).toBe(true)
    expect(await f.errors()).toEqual([])
  })
})

describe("External errors (field-validation)", () => {
  const ui = (errors?: readonly string[], validate?: (v: unknown) => string | null) => (
    <Shell>
      <Field.Root {...(errors ? { errors } : {})} {...(validate ? { validate } : {})}>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>
    </Shell>
  )
  const withErrors = async (validate?: (v: unknown) => string | null) => {
    const view = render(ui(undefined, validate))
    await act(async () => view.rerender(ui(["Not available"], validate)))
    return view
  }

  it("are displayed at once and not cleared by a blur (react-spectrum#9444)", async () => {
    await withErrors()
    const f = getField(screen, { label: "Email" })
    expect(await f.errors()).toEqual(["Not available"])
    expect(await f.isInvalid()).toBe(true)
    await userEvent.click(input())
    await userEvent.tab()
    expect(await f.errors()).toEqual(["Not available"])
  })

  // Errors present at mount (an action state from the server) reach the machine through the
  // `initialErrors` root effect.
  it("given at mount are displayed too", async () => {
    render(ui(["Not available"]))
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Not available"])
  })

  it("are cleared by the next change, which then runs validate (base-ui#1745, base-ui#4095)", async () => {
    await withErrors((v) => (v === "b" ? "Too short" : null))
    const f = getField(screen, { label: "Email" })
    await userEvent.type(input(), "b")
    expect(await f.errors()).toEqual(["Too short"])
  })

  it("are cleared by a change that passes validate", async () => {
    await withErrors()
    await userEvent.type(input(), "c")
    expect(await getField(screen, { label: "Email" }).errors()).toEqual([])
  })

  it("set the native custom validity so the form is blocked", async () => {
    await withErrors()
    expect(form().checkValidity()).toBe(false)
    expect(input().validationMessage).toBe("Not available")
  })
})

describe("Asynchronous validation (field-validation)", () => {
  it("data-validating until the promise settles, then the result", async () => {
    let settle!: (r: string | null) => void
    const validate = () =>
      new Promise<string | null>((r) => {
        settle = r
      })
    render(
      <Field.Root validationMode="change" validate={validate}>
        <Field.Label>User</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>,
    )
    const f = getField(screen, { label: "User" })
    await userEvent.type(input(), "a")
    expect(await f.isValidating()).toBe(true)
    expect(await f.isInvalid()).toBe(false)
    await act(async () => settle("Taken"))
    expect(await f.isValidating()).toBe(false)
    expect(await f.errors()).toEqual(["Taken"])
    expect(input().validationMessage).toBe("Taken")
  })

  it("keeps the error already displayed while validating the next value", async () => {
    const resolvers: ((r: string | null) => void)[] = []
    const validate = () =>
      new Promise<string | null>((r) => {
        resolvers.push(r)
      })
    render(
      <Field.Root validationMode="change" validate={validate}>
        <Field.Label>User</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>,
    )
    const f = getField(screen, { label: "User" })
    await userEvent.type(input(), "a")
    await act(async () => resolvers.at(-1)?.("Taken"))
    await userEvent.type(input(), "b")
    expect(await f.isValidating()).toBe(true)
    expect(await f.isInvalid()).toBe(true)
    await act(async () => resolvers.at(-1)?.(null))
    expect(await f.isValid()).toBe(true)
  })
})

describe("Validation behaviour (field-validation)", () => {
  it("native blocks submission and displays the error (react-spectrum#7317)", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <Shell onSubmit={onSubmit}>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
    expect(input().required).toBe(true)
  })

  it("aria does not block: aria-required, no required, submit fires, error shown after the attempt", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <Shell onSubmit={onSubmit}>
        <Field.Root required validationBehavior="aria" validate={(v) => (v ? null : "Required")}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    expect(input().getAttribute("aria-required")).toBe("true")
    expect(has(input(), "required")).toBe(false)
    expect(form().checkValidity()).toBe(true)
    await send()
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(has(input(), "required")).toBe(false)
  })

  it("aria behaviour displays validate errors in change mode without touching native validity", async () => {
    render(
      <Shell>
        <Field.Root
          validationBehavior="aria"
          validationMode="change"
          validate={(v) => (v ? "Nope" : null)}
        >
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await userEvent.type(input(), "a")
    expect(await getField(screen, { label: "Email" }).errors()).toEqual(["Nope"])
    expect(input().validity.customError).toBe(false)
    expect(form().checkValidity()).toBe(true)
  })
})

describe("Browser validation bubble (field-validation)", () => {
  /** The `invalid` events fired on the input, with whether they were cancelled afterwards. */
  function watchInvalid() {
    const seen: Event[] = []
    const onInvalid = (e: Event) => seen.push(e)
    document.addEventListener("invalid", onInvalid, true)
    return {
      seen,
      stop: () => document.removeEventListener("invalid", onInvalid, true),
    }
  }

  it("without an ErrorMessage the browser's bubble is kept (invalid is not cancelled)", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
        </Field.Root>
      </Shell>,
    )
    const w = watchInvalid()
    await send()
    w.stop()
    expect(w.seen.length).toBeGreaterThan(0)
    expect(w.seen.every((e) => !e.defaultPrevented)).toBe(true)
    // The attempt is still recorded and the error displayed.
    expect(has(rootOf("Email"), "data-invalid")).toBe(true)
  })

  it("with an ErrorMessage the bubble is suppressed (invalid is cancelled)", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    const w = watchInvalid()
    await send()
    w.stop()
    expect(w.seen.length).toBeGreaterThan(0)
    expect(w.seen.every((e) => e.defaultPrevented)).toBe(true)
    expect(await getField(screen, { label: "Email" }).errors()).toEqual([input().validationMessage])
  })
})

describe("Focus on the first invalid control (field-validation)", () => {
  it("a plain form with two invalid Fields: the first is focused, both errors are shown", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>First</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
        <Field.Root>
          <Field.Label>Second</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(document.activeElement).toBe(input("First"))
    expect(await getField(screen, { label: "First" }).isInvalid()).toBe(true)
    expect(await getField(screen, { label: "Second" }).isInvalid()).toBe(true)
    expect((await getField(screen, { label: "First" }).errors()).length).toBe(1)
    expect((await getField(screen, { label: "Second" }).errors()).length).toBe(1)
    // Only that Field takes focus.
    expect(has(rootOf("First"), "data-focus")).toBe(true)
    expect(has(rootOf("Second"), "data-focus")).toBe(false)
  })

  it("the focus ring shows: data-focus-visible, though the submit was a pointer click", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>First</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await send()
    expect(document.activeElement).toBe(input())
    expect(has(rootOf("First"), "data-focus-visible")).toBe(true)
  })

  it("tree order, not mount order: a Field mounted above an existing invalid one wins (base-ui#5284, ariakit#6305)", async () => {
    const ui = (withTop: boolean) => (
      <Shell>
        {withTop ? (
          <Field.Root>
            <Field.Label>Top</Field.Label>
            <FieldInput required />
            <Field.ErrorMessage />
          </Field.Root>
        ) : null}
        <Field.Root>
          <Field.Label>Bottom</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>
    )
    const { rerender } = render(ui(false))
    await act(async () => rerender(ui(true)))
    await send()
    expect(document.activeElement).toBe(input("Top"))
    expect(has(rootOf("Top"), "data-focus-visible")).toBe(true)
    expect(has(rootOf("Bottom"), "data-invalid")).toBe(true)
  })

  it("the text of the focused input is not selected", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Code</Field.Label>
          <FieldInput pattern="[0-9]+" defaultValue="abc" />
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    input().setSelectionRange(1, 1)
    await send()
    expect(document.activeElement).toBe(input())
    expect(input().selectionStart).toBe(input().selectionEnd)
  })

  it("a removed control: submitting throws nothing and focuses nothing (base-ui#2228)", async () => {
    const errors: ErrorEvent[] = []
    const onError = (e: ErrorEvent) => errors.push(e)
    window.addEventListener("error", onError)
    const ui = (withControl: boolean) => (
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          {withControl ? <FieldInput required /> : null}
          <Field.ErrorMessage />
        </Field.Root>
        <input aria-label="Other" />
      </Shell>
    )
    const { rerender } = render(ui(true))
    await act(async () => rerender(ui(false)))
    expect(() => form().requestSubmit()).not.toThrow()
    await nextTick()
    window.removeEventListener("error", onError)
    expect(errors).toEqual([])
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(false)
    expect(document.activeElement).not.toBe(screen.getByLabelText("Other"))
  })
})

describe("Description and error wiring (field-control)", () => {
  it("error appears and goes: Description then error, then Description alone, nothing dangling (react-spectrum#2330)", async () => {
    render(
      <Shell>
        <Field.Root validationMode="change" validate={(v) => (v ? "Enter a valid email" : null)}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.Description>We never share it</Field.Description>
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    const f = getField(screen, { label: "Email" })
    expect(await f.controlDescription()).toBe("We never share it")
    await userEvent.type(input(), "a")
    expect(await f.controlDescription()).toBe("We never share it Enter a valid email")
    const [description, error] = idsOf(input())
    expect(description).toBe(screen.getByText("We never share it").id)
    expect(error).toBe(screen.getByText("Enter a valid email").id)
    await userEvent.clear(input())
    await vi.waitFor(() => expect(screen.queryByText("Enter a valid email")).toBeNull())
    expect(await f.controlDescription()).toBe("We never share it")
    expect(idsOf(input())).toEqual([description])
    for (const id of idsOf(input())) expect(document.getElementById(id)).not.toBeNull()
  })

  it("no Description and no error: no aria-describedby at all, never an empty string", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>,
    )
    await vi.waitFor(() => expect(has(input(), "aria-describedby")).toBe(false))
  })

  it("the consumer's and the control's own ids come after the Field's", async () => {
    render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput aria-describedby="mine" />
        <Field.Description>Hint</Field.Description>
        <span id="mine">Mine</span>
      </Field.Root>,
    )
    await vi.waitFor(() => expect(idsOf(input())).toEqual([screen.getByText("Hint").id, "mine"]))
  })

  it("VoiceOver reads the error: described by the error, no aria-errormessage by default (ark#4150)", async () => {
    render(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>,
    )
    const message = screen.getByText("Enter a valid email")
    expect(idsOf(input())).toContain(message.id)
    expect(has(input(), "aria-errormessage")).toBe(false)
    expect(input().getAttribute("aria-invalid")).toBe("true")
  })

  it('errorMessageAttribute="both" adds aria-errormessage while the error is shown', async () => {
    const ui = (invalid: boolean) => (
      <Field.Root invalid={invalid} errorMessageAttribute="both">
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>
    )
    const { rerender } = render(ui(true))
    const message = screen.getByText("Enter a valid email")
    expect(input().getAttribute("aria-errormessage")).toBe(message.id)
    expect(idsOf(input())).toContain(message.id)
    await act(async () => rerender(ui(false)))
    await vi.waitFor(() => expect(has(input(), "aria-errormessage")).toBe(false))
  })

  it("the error is never part of the name (kobalte#534)", async () => {
    render(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(await getField(screen, { label: "Email" }).controlName()).toBe("Email")
  })

  it("no Label rendered with an aria-label: no aria-labelledby and no for (ark#3824)", async () => {
    render(
      <Field.Root>
        <FieldInput aria-label="Search" />
        <Field.Description>Hint</Field.Description>
      </Field.Root>,
    )
    expect(has(input("Search"), "aria-labelledby")).toBe(false)
    expect(document.querySelector("[for]")).toBeNull()
    expect(input("Search").getAttribute("aria-label")).toBe("Search")
  })
})

describe("One registered control (field-control)", () => {
  it("two controls in one Field: a warning names both; the first is wired", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root required>
        <Field.Label>Pair</Field.Label>
        <FieldInput id="first-control" />
        <FieldInput id="second-control" aria-label="Second" />
      </Field.Root>,
    )
    const message = warn.mock.calls.map((c) => String(c[0])).find((m) => m.includes("field"))
    // The warning names both claim tokens (useId values), not the consumer ids.
    expect(message?.match(/\(([^)]+)\)/g)).toHaveLength(2)
    expect(message).toContain("second control")
    expect(message).toContain("Fieldset")
    expect(document.getElementById("first-control")?.hasAttribute("required")).toBe(true)
  })

  // field-control "Two controls in one Field": the second control keeps its own attributes.
  // claim() refuses the second control: it gets no binding.
  it("a second control keeps its own attributes (zag#2475)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root required>
        <Field.Label>Pair</Field.Label>
        <FieldInput id="first-control" />
        <FieldInput id="second-control" aria-label="Second" />
        <Field.Description>Hint</Field.Description>
      </Field.Root>,
    )
    expect(document.getElementById("second-control")?.hasAttribute("required")).toBe(false)
    expect(document.getElementById("second-control")?.hasAttribute("aria-describedby")).toBe(false)
  })

  it("registering twice under StrictMode warns about no second control", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <StrictMode>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput required />
        </Field.Root>
      </StrictMode>,
    )
    expect(warn).not.toHaveBeenCalled()
  })

  // StrictMode re-runs effects between stop() and start(); registration no longer depends on
  // machine events, so the Field keeps its control.
  it("is wired under StrictMode (tasks 5.2): a failed submit shows the error", async () => {
    render(
      <StrictMode>
        <Shell>
          <Field.Root>
            <Field.Label>Email</Field.Label>
            <FieldInput required />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>
      </StrictMode>,
    )
    await send()
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
    expect(document.activeElement).toBe(input())
  })

  // The baseline stays the first registration's; the value is re-read on every registration.
  it("remounting the control keeps the first baseline and re-reads the value", async () => {
    const ui = (key: string) => (
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput key={key} defaultValue="first" />
      </Field.Root>
    )
    const { rerender } = render(ui("a"))
    const f = getField(screen, { label: "Email" })
    expect(await f.isDirty()).toBe(false)
    await userEvent.type(input(), "!")
    expect(await f.isDirty()).toBe(true)
    await act(async () => rerender(ui("b")))
    // A fresh control with the same text as the baseline: not dirty.
    expect(input().value).toBe("first")
    expect(await f.isDirty()).toBe(false)
  })

  it.todo(
    "Radio items keep their own ids and no warning is emitted (base-ui#4121): add-radio-group",
  )
  it.todo("A Combobox's popup input does not inherit the Field wiring (base-ui#4120): add-combobox")
  it.todo(
    "A Select trigger (role combobox) has aria-invalid and data-invalid (react-spectrum#8382): add-select",
  )
  it.todo(
    "Label click focuses a Select trigger, not its hidden input, and the Select stays closed (base-ui#2113): add-select",
  )
  it.todo("Label click toggles a Checkbox once and names it: add-checkbox")
  it.todo(
    "A Checkbox inside a Field in change mode validates once per toggle (base-ui#4902): add-checkbox",
  )
  it.todo(
    "Autofilling a read-only control's hidden input keeps the value and the server error (base-ui#4828): add-select",
  )
  it.todo(
    "A required, empty Select is neither valid nor invalid before submit (bits-ui#1021): add-select",
  )
  it.todo(
    "Opening a Select popup with the keyboard and closing it does not touch the Field: add-select",
  )
  it.todo(
    "Selecting a Radio Group and clearing it before any attempt shows no error (react-spectrum#6096): add-radio-group",
  )
  it.todo(
    "A required Radio Group with no selection focuses its first enabled radio (react-spectrum#3883): add-radio-group",
  )
  it.todo(
    "A required checkbox in a group takes focus after a failed submit (base-ui#5200): add-checkbox-group",
  )
  it.todo(
    "A Select's server error is cleared by picking another option, then validated (base-ui#1745): add-select",
  )
  it.todo(
    "The Field prop x control matrix for every rind-ui form control (ark#3930, ark#3286): add-text-field",
  )
})

describe("Reset (field-validation)", () => {
  const ui = (onReset?: (e: React.FormEvent<HTMLFormElement>) => void) => (
    <Shell {...(onReset ? { onReset } : {})}>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput required />
        <Field.ErrorMessage />
      </Field.Root>
    </Shell>
  )
  const reset = () => userEvent.click(screen.getByRole("button", { name: "Clear" }))

  it("clears the displayed error and the flags", async () => {
    render(ui())
    const f = getField(screen, { label: "Email" })
    await userEvent.type(input(), "a")
    await userEvent.tab()
    await userEvent.clear(input())
    await send()
    expect(await f.isInvalid()).toBe(true)
    expect(await f.isTouched()).toBe(true)
    await reset()
    await vi.waitFor(async () => expect(await f.isInvalid()).toBe(false))
    expect(await f.isTouched()).toBe(false)
    expect(await f.isDirty()).toBe(false)
    expect(await f.errors()).toEqual([])
    expect(input().validity.customError).toBe(false)
  })

  it("a reset the consumer cancels changes nothing (react-spectrum#7602)", async () => {
    render(ui((e) => e.preventDefault()))
    const f = getField(screen, { label: "Email" })
    await send()
    await userEvent.tab()
    expect(await f.isInvalid()).toBe(true)
    await reset()
    await nextTick()
    expect(await f.isInvalid()).toBe(true)
    expect(await f.isTouched()).toBe(true)
    expect((await f.errors()).length).toBe(1)
  })

  it("filled is re-read after the control reset (base-ui#5765)", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>
      </Shell>,
    )
    const f = getField(screen, { label: "Email" })
    await userEvent.type(input(), "abc")
    expect(await f.isFilled()).toBe(true)
    expect(has(rootOf("Email"), "data-filled")).toBe(true)
    await reset()
    expect(input().value).toBe("")
    await vi.waitFor(() => expect(has(rootOf("Email"), "data-filled")).toBe(false))
  })

  it("server errors from the errors prop are cleared too", async () => {
    await renderThenErrors(
      (errors) => (
        <Shell>
          <Field.Root {...(errors ? { errors } : {})}>
            <Field.Label>Email</Field.Label>
            <FieldInput />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>
      ),
      ["Not available"],
    )
    const f = getField(screen, { label: "Email" })
    expect(await f.errors()).toEqual(["Not available"])
    await reset()
    await vi.waitFor(async () => expect(await f.isInvalid()).toBe(false))
  })
})

describe("Announcements (field-validation)", () => {
  const rec = recordingAnnouncer()
  const wrap = (ui: ReactNode) => <RindProvider announcer={rec.announcer}>{ui}</RindProvider>
  const afterEachClear = () => {
    rec.log.length = 0
  }
  afterEach(afterEachClear)

  it("blur mode: one polite announcement when the error appears after tabbing on", async () => {
    render(
      wrap(
        <Shell>
          <Field.Root validationMode="blur" validate={(v) => (v ? "Enter a valid email" : null)}>
            <Field.Label>Email</Field.Label>
            <FieldInput />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>,
      ),
    )
    await userEvent.type(input(), "abc")
    expect(rec.log).toEqual([])
    await userEvent.tab()
    expect(rec.log.map((a) => a.message)).toEqual(["Email: Enter a valid email"])
    expect(rec.log[0]?.priority).toBe("polite")
  })

  it("the same message twice is not repeated while typing on (change mode)", async () => {
    render(
      wrap(
        <Field.Root validationMode="change" validate={(v) => (v ? "Enter a valid email" : null)}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>,
      ),
    )
    await userEvent.type(input(), "abcd")
    expect(rec.log).toHaveLength(1)
  })

  it("clearing the error makes no announcement", async () => {
    render(
      wrap(
        <Field.Root validationMode="change" validate={(v) => (v ? "Enter a valid email" : null)}>
          <Field.Label>Email</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>,
      ),
    )
    await userEvent.type(input(), "a")
    await userEvent.clear(input())
    expect(rec.log).toHaveLength(1)
  })

  it("a failed submit that moves focus to the control announces nothing (the focus speaks)", async () => {
    render(
      wrap(
        <Shell>
          <Field.Root>
            <Field.Label>Email</Field.Label>
            <FieldInput required />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>,
      ),
    )
    await send()
    expect(document.activeElement).toBe(input())
    expect(rec.log).toEqual([])
  })

  // `focusIfFirst` marks focus as moved only when the Field was not already focused.
  it("Enter in the only, focused, invalid Field announces once (react-spectrum#8328)", async () => {
    render(
      wrap(
        <Shell>
          <Field.Root validate={(v) => (v ? "Enter a valid email" : null)}>
            <Field.Label>Email</Field.Label>
            <FieldInput />
            <Field.ErrorMessage />
          </Field.Root>
        </Shell>,
      ),
    )
    await userEvent.type(input(), "abc{Enter}")
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
    expect(document.activeElement).toBe(input())
    expect(rec.log.map((a) => a.message)).toEqual(["Email: Enter a valid email"])
  })
})

describe("Accessibility", () => {
  it("passes axe in the valid and the invalid state", async () => {
    render(
      <Shell>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput type="email" required />
          <Field.Description>We never share it</Field.Description>
          <Field.ErrorMessage />
        </Field.Root>
      </Shell>,
    )
    await a11y()
    await send()
    expect(await getField(screen, { label: "Email" }).isInvalid()).toBe(true)
    await a11y()
  })
})

describe("review fixes (add-field r1)", () => {
  it("an untouched Field with a rejecting validate blocks submission and shows the error", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Field.Root validate={() => "Not allowed"}>
          <Field.Label>Code</Field.Label>
          <FieldInput defaultValue="abc" />
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Go</button>
      </form>,
    )
    const input = screen.getByRole("textbox", { name: "Code" }) as HTMLInputElement
    // Evaluated at mount, nothing displayed yet.
    expect(input.form?.checkValidity()).toBe(false)
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    await userEvent.click(screen.getByRole("button", { name: "Go" }))
    expect(onSubmit).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"))
    expect(await getField(screen, { label: "Code" }).errors()).toEqual(["Not allowed"])
  })

  it("aria behaviour in a plain form: the submit fires and the required error is displayed after it", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Field.Root validationBehavior="aria" required>
          <Field.Label>Name</Field.Label>
          <FieldInput />
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Go</button>
      </form>,
    )
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input.hasAttribute("required")).toBe(false)
    expect(input.getAttribute("aria-required")).toBe("true")
    await userEvent.click(screen.getByRole("button", { name: "Go" }))
    expect(onSubmit).toHaveBeenCalledOnce()
    const field = getField(screen, { label: "Name" })
    await vi.waitFor(async () => expect(await field.isInvalid()).toBe(true))
    expect((await field.errors())[0]?.length).toBeGreaterThan(0)
    expect(input.getAttribute("aria-invalid")).toBe("true")
  })
})
