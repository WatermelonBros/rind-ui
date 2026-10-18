// add-alert-dialog 5.3: on open a screen reader reaches the alert dialog's name, then its
// description, then the focused "Cancel", in that order.
import { Dialog } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

it("the alert dialog name, then the description, then Cancel", async () => {
  const { container } = render(
    <Dialog.Root role="alertdialog" defaultOpen>
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Delete project?</Dialog.Title>
          <Dialog.Description>This cannot be undone.</Dialog.Description>
          <Dialog.Cancel>Cancel</Dialog.Cancel>
          <Dialog.Action>Delete</Dialog.Action>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 12; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const dialog = at(/alertdialog.*Delete project\?|Delete project\?.*alertdialog|alert dialog/i)
  const description = at(/This cannot be undone/, dialog)
  const cancel = at(/Cancel/, description)
  const del = at(/Delete$|button.*Delete\b/, cancel)
  const order = [dialog, description, cancel, del]
  expect(
    order.every((i) => i >= 0),
    JSON.stringify({ order, log }),
  ).toBe(true)
  expect(log[cancel]).toMatch(/button/)
})
