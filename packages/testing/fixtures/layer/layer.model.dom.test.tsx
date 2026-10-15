// testMachine over the layer fixture: every modality (virtual included), modal and presence
// invariants after each step, unmount while open, in jsdom and the browser.
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { testMachine } from "../../src/index"
import { layerContract } from "./layer.contract"
import { LayerExample } from "./layer.fixture"

describe("layer model", () => {
  testMachine(layerContract, {
    test: it,
    setup: () =>
      render(
        <div id="app">
          <LayerExample label="Settings" />
        </div>,
      ),
    target: () => screen,
    anchor: ["Settings"],
    // `root` is internal (set by Layer.Root); the oracle only needs a value.
    props: { open: undefined, root: "oracle" },
    modalities: ["pointer", "keyboard", "touch", "virtual"],
  })
})
