import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { DisclosureExample } from "./disclosure.fixture"
import { disclosureScenario } from "./disclosure.scenario"

describe("disclosure driver", () => {
  it("runs the shared scenario", async () => {
    render(<DisclosureExample />)
    await disclosureScenario(screen)
  })
})
