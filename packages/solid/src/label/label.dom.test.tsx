/** @jsxImportSource solid-js */
// Label: the same markup as @rind-ui/react; a non-label forwards a click to the control.
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Label } from "../index"

describe("Solid Label matches React", () => {
  it("for, wrapping, substitution", async () => {
    await clientParity(
      r("div", null, r(R.Label, { htmlFor: "n" }, "Name"), r("input", { id: "n" })),
      () => (
        <div>
          <Label for="n">Name</Label>
          <input id="n" />
        </div>
      ),
    )
    await clientParity(r(R.Label, null, "Name ", r("input")), () => (
      <Label>
        Name <input />
      </Label>
    ))
    await clientParity(
      r(
        "div",
        null,
        r(R.Label, { htmlFor: "n", render: r("div") }, "Name"),
        r("input", { id: "n" }),
      ),
      () => (
        <div>
          <Label for="n" render={(p) => <div {...p} />}>
            Name
          </Label>
          <input id="n" />
        </div>
      ),
    )
  })

  it("a substituted element forwards a click to the control", () => {
    mount(() => (
      <div>
        <Label for="f" render={(p) => <div {...p} />}>
          Name
        </Label>
        <input id="f" />
      </div>
    ))
    screen.getByText("Name").click()
    expect(document.activeElement).toBe(document.getElementById("f"))
  })
})
