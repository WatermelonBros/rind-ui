// Model-based tests (formerly add-alert-dialog 5.2): the confirmation contract (role="alertdialog") over every transition in pointer,
// touch, keyboard and virtual, both directions, with the layer, modal, restores-focus and
// presence invariants and axe per state. Outside presses leave it open.
import { alertDialogRoleContract } from "@rind-ui/core"
import { Dialog, type DialogRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Example(props: Omit<DialogRootProps<"alertdialog">, "role">) {
  return (
    <div id="app">
      <Dialog.Root role="alertdialog" {...props}>
        <Dialog.Trigger>Delete project?</Dialog.Trigger>
        <Dialog.Portal>
          {/* As a theme lays them out: a full-screen backdrop, the content centred. */}
          <Dialog.Backdrop style={{ position: "fixed", inset: 0 }} />
          <Dialog.Positioner
            style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center" }}
          >
            <Dialog.Content>
              <Dialog.Title>Delete project?</Dialog.Title>
              <Dialog.Description>This cannot be undone.</Dialog.Description>
              <Dialog.Cancel>Cancel</Dialog.Cancel>
              <Dialog.Action>Delete</Dialog.Action>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

for (const { name, props } of [
  { name: "default", props: {} },
  { name: "closeOnEscape false", props: { closeOnEscape: false } },
]) {
  describe(`alert dialog model: ${name}`, () => {
    testMachine(alertDialogRoleContract, {
      test: it,
      setup: () => render(<Example {...props} />),
      target: () => screen,
      anchor: [{ name: "Delete project?" }] as never,
      props: {
        open: undefined,
        root: "oracle",
        role: "alertdialog",
        modal: undefined,
        closeOnEscape: undefined,
        closeOnInteractOutside: undefined,
        ...props,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}
