// Fieldset: the same DOM as @rind-ui/react across its anatomy, nesting and first-legend
// exemption (rind controls inside), and disabled at runtime.
import { Component, input } from "@angular/core"
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Button } from "../button/button"
import { Toggle } from "../toggle/toggle"
import { Fieldset } from "./fieldset"

interface Cfg {
  readonly root: { disabled?: boolean; invalid?: boolean; "aria-describedby"?: string }
  readonly legend: boolean
  readonly desc: boolean
  readonly error: boolean
}
/** The tree the next fixture renders (a server render cannot set inputs). */
let current: Cfg = { root: {}, legend: true, desc: true, error: true }

@Component({
  selector: "rind-f",
  imports: [Fieldset, Button, Toggle],
  template: `@if (cfg.root["aria-describedby"]) {
      <fieldset
        rindFieldsetRoot
        [disabled]="cfg.root.disabled ?? false"
        [invalid]="cfg.root.invalid ?? false"
        aria-describedby="extra"
      >
      @if (cfg.legend) {
        <legend rindFieldsetLegend>Shipping<button rindButton>Help</button></legend>
      }
      @if (cfg.desc) {
        <p rindFieldsetDescription>Where it goes</p>
      }
      <button rindToggleRoot>Gift</button>
      <input aria-label="Street" />
      @if (cfg.error) {
        <p rindFieldsetErrorMessage>Required</p>
      }
      </fieldset>
    } @else {
      <fieldset
        rindFieldsetRoot
        [disabled]="cfg.root.disabled ?? false"
        [invalid]="cfg.root.invalid ?? false"
      >
      @if (cfg.legend) {
        <legend rindFieldsetLegend>Shipping<button rindButton>Help</button></legend>
      }
      @if (cfg.desc) {
        <p rindFieldsetDescription>Where it goes</p>
      }
      <button rindToggleRoot>Gift</button>
      <input aria-label="Street" />
      @if (cfg.error) {
        <p rindFieldsetErrorMessage>Required</p>
      }
      </fieldset>
    }`,
})
class Tree {
  readonly cfg = current
}
const reactTree = ({ root, legend, desc, error }: Cfg) =>
  r(
    R.Fieldset.Root,
    root,
    legend ? r(R.Fieldset.Legend, null, "Shipping", r(R.Button, null, "Help")) : null,
    desc ? r(R.Fieldset.Description, null, "Where it goes") : null,
    r(R.Toggle.Root, null, "Gift"),
    r("input", { "aria-label": "Street" }),
    error ? r(R.Fieldset.ErrorMessage, null, "Required") : null,
  )

@Component({
  selector: "rind-f",
  imports: [Fieldset, Button],
  template: `<fieldset rindFieldsetRoot [disabled]="true">
    <fieldset rindFieldsetRoot><legend rindFieldsetLegend>Inner</legend><button rindButton>Go</button></fieldset>
  </fieldset>`,
})
class Nested {}

@Component({
  selector: "rind-f",
  imports: [Fieldset],
  template: `<fieldset rindFieldsetRoot><div rindFieldsetLegend>Name</div></fieldset>`,
})
class DivLegend {}

describe("Angular Fieldset matches React", () => {
  it("anatomy, invalid, disabled, legend exemption, no parts", async () => {
    const cfgs: Cfg[] = [
      { root: {}, legend: true, desc: true, error: true },
      { root: { invalid: true }, legend: true, desc: true, error: true },
      { root: { disabled: true }, legend: true, desc: true, error: true },
      {
        root: { disabled: true, invalid: true, "aria-describedby": "extra" },
        legend: true,
        desc: true,
        error: true,
      },
      { root: {}, legend: false, desc: false, error: false },
      { root: { invalid: true }, legend: true, desc: false, error: false },
    ]
    for (const cfg of cfgs) {
      current = cfg
      await both(reactTree(cfg), Tree)
    }
  })

  it("nested: the inner fieldset inherits disabled", async () => {
    await both(
      r(
        R.Fieldset.Root,
        { disabled: true },
        r(R.Fieldset.Root, null, r(R.Fieldset.Legend, null, "Inner"), r(R.Button, null, "Go")),
      ),
      Nested,
    )
  })

  it("another element as the legend labels by id", async () => {
    await both(
      r(R.Fieldset.Root, null, r(R.Fieldset.Legend, { render: r("div") }, "Name")),
      DivLegend,
    )
  })
})

const onPress = vi.fn()
@Component({
  imports: [Fieldset, Button],
  template: `<fieldset rindFieldsetRoot [disabled]="disabled()">
    <button rindButton (press)="pressed()">Go</button>
  </fieldset>`,
})
class Runtime {
  readonly disabled = input(true)
  pressed() {
    onPress()
  }
}

describe("Angular Fieldset disabled at runtime", () => {
  it("presses are ignored while disabled, then work again", async () => {
    const view = await mount(Runtime, { disabled: true })
    const button = screen.getByRole("button", { name: "Go" })
    expect(button.hasAttribute("data-disabled")).toBe(true)
    button.click()
    expect(onPress).not.toHaveBeenCalled()
    await view.rerender({ disabled: false })
    await vi.waitFor(() => expect(button.hasAttribute("data-disabled")).toBe(false))
    button.click()
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
