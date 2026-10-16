// Model-based tests (task 6.1): the Popover contract over every transition in pointer,
// touch, keyboard and virtual, for modal false and true, with the layer, restores-focus,
// presence, anchored and (modal) modal invariants and axe per state.
import { modalPopoverContract, popoverContract } from "@rind-ui/core"
import { Popover, type PopoverRootProps } from "@rind-ui/react"
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

function Example(props: Partial<PopoverRootProps>) {
  return (
    <div id="app">
      <Popover.Root {...props}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Title>Filters</Popover.Title>
              <Popover.Description>Narrow the list.</Popover.Description>
              <label>
                Search <input />
              </label>
              <Popover.CloseTrigger>Done</Popover.CloseTrigger>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <button type="button">After</button>
    </div>
  )
}

for (const modal of [false, true]) {
  describe(`popover model: ${modal ? "modal" : "non-modal"}`, () => {
    testMachine(modal ? modalPopoverContract : popoverContract, {
      test: it,
      setup: () => render(<Example modal={modal} />),
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by Popover.Root); the oracle only needs a value.
      props: {
        open: undefined,
        root: "oracle",
        modal,
        disabled: undefined,
        closeOnEscape: undefined,
        closeOnInteractOutside: undefined,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}
