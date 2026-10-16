// React 19 form actions (openspec form "Reset", tasks 3.2): React resets an uncontrolled form
// after its action completes, with no user event in progress. The server errors the action
// returned must survive that reset (react-spectrum#6830, #7708); a reset button still
// clears them.
import { Field, Form } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useActionState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getForm } from "../../src/index"
import { FieldInput } from "../field/field-input"

type State = { readonly errors?: Record<string, string> }

function Page({ action }: { readonly action: (fd: FormData) => Promise<State> }) {
  const [state, run] = useActionState<State, FormData>((_prev, fd) => action(fd), {})
  return (
    <Form.Root
      aria-label="Sign up"
      action={run}
      {...(state.errors ? { errors: state.errors } : {})}
    >
      <Field.Root name="email">
        <Field.Label>Email</Field.Label>
        <FieldInput required />
        <Field.ErrorMessage />
      </Field.Root>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </Form.Root>
  )
}

const email = () => screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i++) await frame()
  })

async function submitWithServerError() {
  // A real action awaits the network: it settles in a later task, not in the submit event's
  // microtasks (where `window.event` would still be the submit and the reset look like a user's).
  const action = vi.fn(async () => {
    await frame()
    return { errors: { email: "Already registered" } }
  })
  render(<Page action={action} />)
  await userEvent.type(email(), "a@b.co")
  await getForm(screen, { name: "Sign up" }).submit()
  await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  return action
}

describe("Form with a React 19 action", () => {
  it("server errors survive the automatic reset (react-spectrum#6830, #7708)", async () => {
    await submitWithServerError()
    await vi.waitFor(() => expect(screen.getByText("Already registered")).toBeTruthy())
    // React reset the uncontrolled form after the action; give it and the Field's reset time.
    await vi.waitFor(() => expect(email().value).toBe(""))
    await settle()
    expect(screen.getByText("Already registered")).toBeTruthy()
    expect(email().validity.valid).toBe(false)
  })

  it("the reset button clears the server error", async () => {
    render(
      <Form.Root aria-label="Sign up" action={() => {}} errors={{ email: "Already registered" }}>
        <Field.Root name="email">
          <Field.Label>Email</Field.Label>
          <FieldInput required />
          <Field.ErrorMessage />
        </Field.Root>
        <button type="reset">Reset</button>
      </Form.Root>,
    )
    expect(screen.getByText("Already registered")).toBeTruthy()
    await getForm(screen, { name: "Sign up" }).reset()
    await vi.waitFor(() => expect(screen.queryByText("Already registered")).toBeNull())
    expect(await getForm(screen, { name: "Sign up" }).invalidFields()).toEqual([])
  })
})
