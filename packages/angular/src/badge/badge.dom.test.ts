// Badge: the same markup as @rind-ui/react for every case of its server-render spec.
import { Component } from "@angular/core"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { both } from "../../fixtures/parity"
import { Badge } from "./badge"

@Component({ selector: "rind-f", imports: [Badge], template: `<span rindBadgeRoot>Beta</span>` })
class Text {}
@Component({
  selector: "rind-f",
  imports: [Badge],
  template: `<span rindBadgeRoot label="3 unread">3</span>`,
})
class Labelled {}
@Component({
  selector: "rind-f",
  imports: [Badge],
  template: `<span rindBadgeRoot id="c">3</span>`,
})
class Id {}
@Component({
  selector: "rind-f",
  imports: [Badge],
  template: `<span rindBadgeRoot data-variant="solid" data-tone="danger">2</span>`,
})
class Themed {}
@Component({ selector: "rind-f", imports: [Badge], template: `<strong rindBadgeRoot>New</strong>` })
class Strong {}

describe("Angular Badge matches React", () => {
  it("text, label, consumer id, theme attributes", async () => {
    await both(r(R.Badge.Root, null, "Beta"), Text)
    await both(r(R.Badge.Root, { label: "3 unread" }, "3"), Labelled)
    await both(r(R.Badge.Root, { id: "c" }, "3"), Id)
    const theme = { "data-variant": "solid", "data-tone": "danger" }
    await both(r(R.Badge.Root, theme as never, "2"), Themed)
  })

  it("any host element", async () => {
    await both(r(R.Badge.Root, { render: r("strong") }, "New"), Strong)
  })
})
