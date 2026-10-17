// Model-based tests (task 5.1): the Hover Card contract over every mapped transition in
// pointer, keyboard, touch and virtual (touch and virtual never open it), with the layer,
// restores-focus, presence, anchored and timed invariants and axe per state.
import { hoverCardContract } from "@rind-ui/core"
import { HoverCard, type HoverCardRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine, virtualClock } from "../index"

// The delays run on a virtual clock: the runner advances it, no real time passes.
const clock = virtualClock()

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Example(props: Partial<HoverCardRootProps>) {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <div id="app">
        <a href="/before">Before</a>
        <HoverCard.Root openDelay={200} closeDelay={100} {...props}>
          <HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Positioner>
              <HoverCard.Content>
                <HoverCard.Arrow />
                <p>Designer in Lisbon.</p>
                <button type="button">Follow</button>
              </HoverCard.Content>
            </HoverCard.Positioner>
          </HoverCard.Portal>
        </HoverCard.Root>
        <a href="/after">After</a>
      </div>
    </RindProvider>
  )
}

describe("hover card model", () => {
  testMachine(hoverCardContract, {
    test: it,
    setup: () => render(<Example />),
    target: () => screen,
    anchor: [{ name: "Jane Doe" }] as never,
    // `root` is internal (set by HoverCard.Root); the oracle only needs a value.
    props: {
      open: undefined,
      root: "oracle",
      disabled: undefined,
      openDelay: 200,
      closeDelay: 100,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    clock,
    a11y,
  })
})
