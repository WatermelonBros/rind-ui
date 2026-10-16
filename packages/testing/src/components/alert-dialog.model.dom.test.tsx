// Model-based tests (task 5.2): the Alert Dialog contract over every transition in pointer,
// touch, keyboard and virtual, both directions, with the layer, modal, restores-focus and
// presence invariants and axe per state. Outside presses leave it open.
import { alertDialogContract } from "@rind-ui/core"
import { AlertDialog, type AlertDialogRootProps } from "@rind-ui/react"
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

function Example(props: Partial<AlertDialogRootProps>) {
  return (
    <div id="app">
      <AlertDialog.Root {...props}>
        <AlertDialog.Trigger>Delete project?</AlertDialog.Trigger>
        <AlertDialog.Portal>
          {/* As a theme lays them out: a full-screen backdrop, the content centred. */}
          <AlertDialog.Backdrop style={{ position: "fixed", inset: 0 }} />
          <AlertDialog.Positioner
            style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center" }}
          >
            <AlertDialog.Content>
              <AlertDialog.Title>Delete project?</AlertDialog.Title>
              <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action>Delete</AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}

for (const { name, props } of [
  { name: "default", props: {} },
  { name: "closeOnEscape false", props: { closeOnEscape: false } },
]) {
  describe(`alert dialog model: ${name}`, () => {
    testMachine(alertDialogContract, {
      test: it,
      setup: () => render(<Example {...props} />),
      target: () => screen,
      anchor: [{ name: "Delete project?" }] as never,
      props: {
        open: undefined,
        root: "oracle",
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
