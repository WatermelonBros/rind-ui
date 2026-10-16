// Model-based tests (task 5.2): the Dialog contract over every transition in pointer,
// touch, keyboard and virtual, both directions, for the props sets modal, non-modal,
// closeOnEscape: false and closeOnInteractOutside: false, with the layer, modal,
// restores-focus and presence invariants and axe per state.
import { dialogContract, nonModalDialogContract } from "@rind-ui/core"
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

function Example(props: Partial<DialogRootProps>) {
  return (
    <div id="app">
      <Dialog.Root {...props}>
        <Dialog.Trigger>Edit profile</Dialog.Trigger>
        <Dialog.Portal>
          {/* As a theme lays them out: a full-screen backdrop, the content centred. */}
          <Dialog.Backdrop style={{ position: "fixed", inset: 0 }} />
          <Dialog.Positioner
            style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center" }}
          >
            <Dialog.Content>
              <Dialog.Title>Edit profile</Dialog.Title>
              <Dialog.Description>Change your display name.</Dialog.Description>
              <label>
                Name <input />
              </label>
              <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

const sets: { name: string; props: Partial<DialogRootProps> }[] = [
  { name: "modal", props: {} },
  { name: "closeOnEscape false", props: { closeOnEscape: false } },
  { name: "closeOnInteractOutside false", props: { closeOnInteractOutside: false } },
]

for (const { name, props } of sets) {
  describe(`dialog model: ${name}`, () => {
    testMachine(dialogContract, {
      test: it,
      setup: () => render(<Example {...props} />),
      target: () => screen,
      anchor: [{ name: "Edit profile" }] as never,
      // `root` is internal (set by Dialog.Root); the oracle only needs a value.
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

describe("dialog model: non-modal", () => {
  testMachine(nonModalDialogContract, {
    test: it,
    setup: () => render(<Example modal={false} />),
    target: () => screen,
    anchor: [{ name: "Edit profile" }] as never,
    props: {
      open: undefined,
      root: "oracle",
      modal: false,
      closeOnEscape: undefined,
      closeOnInteractOutside: undefined,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    a11y,
  })
})
