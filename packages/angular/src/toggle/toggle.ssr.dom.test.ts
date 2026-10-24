// React's and Angular's Toggle render the same server markup (Node's server platform: jsdom only).
import { Component } from "@angular/core"
import { Toggle as ReactToggle } from "@rind-ui/react"
import { createElement as h } from "react"
import { describe, expect, it, vi } from "vitest"
import { hydrate } from "../../fixtures/hydrate"
import { serverParity } from "../../fixtures/parity"
import { Toggle } from "./toggle"

@Component({
  selector: "rind-parity",
  imports: [Toggle],
  template: `<button rindToggleRoot [defaultPressed]="true" [disabled]="true">
    Bold<span rindToggleIndicator></span>
  </button>`,
})
class Fixture {}

const react = () =>
  h(ReactToggle.Root, { defaultPressed: true, disabled: true }, "Bold", h(ReactToggle.Indicator))

describe("angular toggle server parity", () => {
  it("server", () => serverParity(react(), Fixture))
})

@Component({
  selector: "rind-hydrate",
  imports: [Toggle],
  template: `<button rindToggleRoot [defaultPressed]="true">Bold<span rindToggleIndicator></span></button>`,
})
class Hydrated {}

describe("angular toggle hydration", () => {
  it("reuses the server's nodes and attributes, then toggles", async () => {
    const host = await hydrate(Hydrated)
    const button = host.querySelector("button")
    expect(button?.getAttribute("aria-pressed")).toBe("true")
    button?.click()
    await vi.waitFor(() => expect(button?.getAttribute("aria-pressed")).toBe("false"))
  })
})
