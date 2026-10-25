// Switch: React's contract model against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { platforms, switchContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, switchStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Switch } from "./switch"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  checked: undefined,
  defaultChecked: undefined,
  onCheckedChange: undefined,
  disabled: undefined,
  readOnly: undefined,
}
type P = {
  defaultChecked?: boolean
  readonly?: boolean
  disabled?: boolean
  focusableWhenDisabled?: boolean
}
/** The inputs the next fixture starts with; null: controlled by a parent applying every change. */
let current: P | null = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Switch],
  template: `<ng-container rindProvider [environment]="env">
    <form>
      @if (p) {
        <div
          rindSwitchRoot
          name="wifi"
          [defaultChecked]="p.defaultChecked ?? false"
          [readonly]="p.readonly ?? false"
          [disabled]="p.disabled ?? false"
          [focusableWhenDisabled]="p.focusableWhenDisabled ?? false"
        >
          <button rindSwitchControl><span rindSwitchThumb></span></button>
          <label rindSwitchLabel>Wi-Fi</label>
        </div>
      } @else {
        <div rindSwitchRoot name="wifi" [(checked)]="checked">
          <button rindSwitchControl><span rindSwitchThumb></span></button>
          <label rindSwitchLabel>Wi-Fi</label>
        </div>
      }
      <button type="reset">Reset</button>
    </form>
  </ng-container>`,
})
class Wifi {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly p = current
  readonly checked = signal<boolean | undefined>(false)
}
const reactWifi = (p: P) =>
  r(
    "form",
    null,
    r(
      R.Switch.Root,
      { name: "wifi", ...p } as never,
      r(R.Switch.Control, null, r(R.Switch.Thumb)),
      r(R.Switch.Label, null, "Wi-Fi"),
    ),
    r("button", { type: "reset" }, "Reset"),
  )

const switchSteps = switchStepInvariants()
for (const cfg of [
  { name: "uncontrolled", p: {}, props: {} },
  { name: "default checked", p: { defaultChecked: true }, props: { defaultChecked: true } },
  { name: "read-only", p: { readonly: true }, props: { readOnly: true } },
  {
    name: "focusable-disabled",
    p: { disabled: true, focusableWhenDisabled: true },
    props: { disabled: true },
  },
  { name: "controlled, applying", p: null, props: {} },
] as const) {
  describe(`angular switch model: ${cfg.name}`, () => {
    testMachine(switchContract, {
      test: it,
      setup: () => {
        switchSteps.reset()
        current = cfg.p
        return mount(Wifi)
      },
      target: () => screen,
      anchor: [{ name: "Wi-Fi" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: switchSteps.invariants,
      a11y,
    })
  })
}

describe("Angular Switch matches React", () => {
  it("states and flags", async () => {
    for (const p of [{}, { defaultChecked: true }, { readonly: true }] as P[]) {
      current = p
      await both(
        reactWifi({
          ...p,
          ...("readonly" in p ? { readOnly: true, readonly: undefined } : {}),
        } as P),
        Wifi,
      )
    }
  })
})
