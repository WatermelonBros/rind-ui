// Quirk react-action-form-reset (react-spectrum#6830, #7708): React 19 calls form.reset()
// after a form action completes, with no user event in progress (React Aria detects it in
// useFormValidation.ts: no current event, or a `message` event from React's scheduler).
import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

const original = HTMLFormElement.prototype.reset
afterEach(() => {
  HTMLFormElement.prototype.reset = original
})

/** Every form.reset() call, with the type of the event in progress ("none" outside one). */
function recordResets() {
  const resets: string[] = []
  HTMLFormElement.prototype.reset = function (this: HTMLFormElement) {
    const current = Reflect.get(globalThis, "event") as Event | undefined
    resets.push(current?.type ?? "none")
    original.call(this)
  }
  return resets
}

describe("react-action-form-reset", () => {
  it("a completed form action resets the form with no user event in progress", async () => {
    const resets = recordResets()
    render(
      <form action={async () => {}}>
        <input aria-label="Name" name="name" defaultValue="Ada" />
        <button type="submit">Save</button>
      </form>,
    )
    await act(async () => {
      screen.getByRole("button", { name: "Save" }).click()
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(resets).toHaveLength(1)
    expect(["none", "message"]).toContain(resets[0])
  })

  it("a reset from a user click happens during that click", async () => {
    const resets = recordResets()
    render(
      <form>
        <input aria-label="Name" name="name" defaultValue="Ada" />
        <button type="button" onClick={(e) => e.currentTarget.form?.reset()}>
          Clear
        </button>
      </form>,
    )
    await act(async () => {
      screen.getByRole("button", { name: "Clear" }).click()
    })
    expect(resets).toEqual(["click"])
  })
})
