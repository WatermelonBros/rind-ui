import { platforms } from "@rind-ui/core"
import { RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../../src/index"
import { counterContract, toggleContract } from "./press.contract"
import { CounterButton, ToggleButton } from "./press.react"

// Every modality, both directions, both platform presets (add-a11y-foundations 13.1).
const runs = {
  directions: ["ltr", "rtl"] as const,
  platforms: [platforms.apple, platforms.windows],
}
const withPlatform = (ui: React.ReactNode) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui}
  </RindProvider>
)

describe("toggle model", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => render(withPlatform(<ToggleButton>Bold</ToggleButton>)),
    target: () => screen,
    anchor: ["Bold"],
    props: { disabled: undefined },
    ...runs,
  })
})

describe("toggle model, controlled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => render(withPlatform(<ToggleButton pressed={false}>Bold</ToggleButton>)),
    rerender: (next, rendered) =>
      rendered.rerender(withPlatform(<ToggleButton {...next}>Bold</ToggleButton>)),
    target: () => screen,
    anchor: ["Bold"],
    props: { disabled: undefined, pressed: false },
    modalities: ["keyboard"],
  })
})

describe("counter model", () => {
  testMachine(counterContract, {
    test: it,
    setup: () => render(withPlatform(<CounterButton>Add</CounterButton>)),
    target: () => screen,
    anchor: ["Add"],
    props: { disabled: undefined },
    ...runs,
  })
})
