// Submit-type closing buttons with a real mouse click and no exit animation: the click's
// microtask checkpoint runs before the button's activation, so a close on the click itself
// would unmount the form before it submits (radix#1109, #1779).
import { act, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { Dialog } from "../index"

for (const part of ["Cancel", "Action", "CloseTrigger"] as const) {
  it(`a submit-type ${part} submits its form before the dialog closes`, async () => {
    const Button = Dialog[part]
    // A confirmation has Cancel and Action, no close trigger.
    const role = part === "CloseTrigger" ? "dialog" : "alertdialog"
    const submitted: boolean[] = []
    render(
      <Dialog.Root role={role} defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>Delete file?</Dialog.Title>
            <Dialog.Description>It cannot be undone.</Dialog.Description>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitted.push(e.currentTarget.isConnected)
              }}
            >
              <Button type="submit">Confirm</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    const button = await vi.waitFor(() => screen.getByRole("button", { name: "Confirm" }))
    await act(async () => userEvent.click(button))
    await vi.waitFor(() => expect(screen.queryByRole(role)).toBeNull())
    expect(submitted).toEqual([true])
  })
}
