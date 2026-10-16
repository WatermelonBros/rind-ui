// add-dialog 5.4: on open a screen reader reaches the dialog's name, then its description,
// then the first control, in that order.
import { Dialog } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

it("the dialog name, then the description, then the first control", async () => {
  const { container } = render(
    <Dialog.Root defaultOpen>
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Change your display name.</Dialog.Description>
          <button type="button">Save changes</button>
          <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 12; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const dialog = at(/dialog.*Edit profile|Edit profile.*dialog/)
  const description = at(/Change your display name/, dialog)
  const save = at(/Save changes/, description)
  const cancel = at(/Cancel/, save)
  const order = [dialog, description, save, cancel]
  expect(
    order.every((i) => i >= 0),
    JSON.stringify({ order, log }),
  ).toBe(true)
  expect(log[save]).toMatch(/button/)
})
