// Separator: the same markup as @rind-ui/react for every case of its server-render spec.
import { Component, signal } from "@angular/core"
import * as R from "@rind-ui/react"
import { expectRindWarning } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { both } from "../../fixtures/parity"
import { SEPARATOR_HOST, Separator } from "./separator"

@Component({ selector: "rind-f", imports: [Separator], template: `<div rindSeparatorRoot></div>` })
class Plain {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  template: `<div rindSeparatorRoot orientation="vertical"></div>`,
})
class Vertical {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  template: `<div rindSeparatorRoot [decorative]="true"></div>`,
})
class Decorative {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  template: `<div rindSeparatorRoot aria-label="Advanced"></div>`,
})
class Labelled {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  template: `<div rindSeparatorRoot data-variant="v" data-size="lg" data-tone="muted"></div>`,
})
class Themed {}
@Component({ selector: "rind-f", imports: [Separator], template: `<hr rindSeparatorRoot />` })
class Rule {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  providers: [
    {
      provide: SEPARATOR_HOST,
      useValue: signal({ context: "toolbar", defaultOrientation: "vertical" }),
    },
  ],
  template: `<div rindSeparatorRoot></div><div rindSeparatorRoot orientation="horizontal"></div>`,
})
class InToolbar {}
@Component({
  selector: "rind-f",
  imports: [Separator],
  providers: [{ provide: SEPARATOR_HOST, useValue: signal({ context: "listbox" }) }],
  template: `<div rindSeparatorRoot orientation="vertical" aria-label="x"></div>`,
})
class InListbox {}

describe("Angular Separator matches React", () => {
  it("div, vertical, decorative, labelled, theme attributes", async () => {
    await both(r(R.Separator.Root), Plain)
    await both(r(R.Separator.Root, { orientation: "vertical" }), Vertical)
    await both(r(R.Separator.Root, { decorative: true }), Decorative)
    await both(r(R.Separator.Root, { "aria-label": "Advanced" }), Labelled)
    const theme = { "data-variant": "v", "data-size": "lg", "data-tone": "muted" }
    await both(r(R.Separator.Root, theme as never), Themed)
  })

  it("on an <hr>: no role, no children", async () => {
    await both(r(R.Separator.Root, { render: r("hr") }), Rule)
  })

  it("a toolbar host gives vertical by default; a listbox host forces role none", async () => {
    const toolbar = { context: "toolbar", defaultOrientation: "vertical" } as const
    await both(
      r(
        R.SeparatorHostContext,
        { value: toolbar },
        r(R.Separator.Root),
        r(R.Separator.Root, { orientation: "horizontal" }),
      ),
      InToolbar,
    )
    // Both adapters warn that the listbox's decorative separator drops its name.
    expectRindWarning(/decorative separator \(role none\) cannot be named/)
    await both(
      r(
        R.SeparatorHostContext,
        { value: { context: "listbox" } as const },
        r(R.Separator.Root, { orientation: "vertical", "aria-label": "x" }),
      ),
      InListbox,
    )
  })
})
