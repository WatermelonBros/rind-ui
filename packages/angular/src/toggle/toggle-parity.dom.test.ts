// React's and Angular's Toggle render the same markup, after mount (the server side: toggle.ssr.dom.test.ts).
import { Component } from "@angular/core"
import { Toggle as ReactToggle } from "@rind-ui/react"
import { createElement as h } from "react"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
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

describe("angular toggle parity", () => {
  it("client", () => clientParity(react(), Fixture))
})
