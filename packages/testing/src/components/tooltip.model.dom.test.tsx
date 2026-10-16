// Model-based tests (task 6.1): the Tooltip contract over every mapped transition in pointer,
// keyboard and virtual (touch replays hover as touch: never opens), with the generic a11y
// invariants, the tooltip's own (closed content hidden and referenced, never focused) and
// the timed invariant (no delay hides it while hovered or focused).
import { tooltipContract } from "@rind-ui/core"
import { Tooltip, type TooltipRootProps } from "@rind-ui/react"
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

function Example(props: Partial<TooltipRootProps>) {
  return (
    <div id="app">
      <button type="button">Before</button>
      <Tooltip.Root openDelay={200} closeDelay={100} {...props}>
        <Tooltip.Trigger>Delete</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>
              <Tooltip.Arrow />
              Delete permanently
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  )
}

describe("tooltip model", () => {
  testMachine(tooltipContract, {
    test: it,
    setup: () => render(<Example />),
    target: () => screen,
    anchor: [{ name: "Delete" }] as never,
    // `root` is internal (set by Tooltip.Root); the oracle only needs a value.
    props: {
      open: undefined,
      root: "oracle",
      disabled: undefined,
      openDelay: 200,
      closeDelay: 100,
      closeOnPress: undefined,
      skipDelay: undefined,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    a11y,
  })
})
