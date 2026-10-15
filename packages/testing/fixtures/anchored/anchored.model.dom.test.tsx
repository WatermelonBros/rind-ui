// testMachine over the anchored fixture: every modality and direction; in the browser the
// layout invariant (trait `anchored`) checks the placed geometry after every step.
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { testMachine } from "../../src/index"
import { anchoredContract } from "./anchored.contract"
import { AnchoredExample } from "./anchored.react"

describe("anchored model", () => {
  testMachine(anchoredContract, {
    test: it,
    setup: () =>
      render(
        <div style={{ padding: "120px" }}>
          <AnchoredExample label="Details" />
        </div>,
      ),
    target: () => screen,
    anchor: ["Details"],
    props: { open: undefined, root: "oracle" },
    modalities: ["pointer", "keyboard", "touch", "virtual"],
  })
})
