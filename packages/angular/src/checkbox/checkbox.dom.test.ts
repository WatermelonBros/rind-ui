// Checkbox: React's contract model against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { type CheckedState, checkboxContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { checkboxStepInvariants, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Checkbox } from "./checkbox"

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
  defaultChecked?: CheckedState
  readonly?: boolean
  disabled?: boolean
  focusableWhenDisabled?: boolean
  required?: boolean
  invalid?: boolean
  uncheckedValue?: string
  value?: string
  form?: string
}
/** The inputs the next fixture starts with; null: controlled by a parent applying every change. */
let current: P | null = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Checkbox],
  template: `<ng-container rindProvider [environment]="env">
    <form>
      @if (p) {
        <div
          rindCheckboxRoot
          name="tos"
          [defaultChecked]="p.defaultChecked ?? false"
          [readonly]="p.readonly ?? false"
          [disabled]="p.disabled ?? false"
          [focusableWhenDisabled]="p.focusableWhenDisabled ?? false"
          [required]="p.required ?? false"
          [invalid]="p.invalid ?? false"
          [uncheckedValue]="p.uncheckedValue"
          [value]="p.value ?? 'on'"
          [form]="p.form"
        >
          <button rindCheckboxControl><span rindCheckboxIndicator>✓</span></button>
          <label rindCheckboxLabel>Accept terms</label>
          <div rindCheckboxDescription>Required to continue</div>
        </div>
      } @else {
        <div rindCheckboxRoot name="tos" [(checked)]="checked">
          <button rindCheckboxControl><span rindCheckboxIndicator>✓</span></button>
          <label rindCheckboxLabel>Accept terms</label>
          <div rindCheckboxDescription>Required to continue</div>
        </div>
      }
      <button type="reset">Reset</button>
    </form>
  </ng-container>`,
})
class Terms {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly p = current
  readonly checked = signal<CheckedState | undefined>(false)
}
const reactTerms = (p: P) =>
  r(
    "form",
    null,
    r(
      R.Checkbox.Root,
      { name: "tos", ...p } as never,
      r(R.Checkbox.Control, null, r(R.Checkbox.Indicator, null, "✓")),
      r(R.Checkbox.Label, null, "Accept terms"),
      r(R.Checkbox.Description, null, "Required to continue"),
    ),
    r("button", { type: "reset" }, "Reset"),
  )

const checkboxSteps = checkboxStepInvariants()
for (const cfg of [
  { name: "uncontrolled", p: {}, props: {} },
  {
    name: "indeterminate default",
    p: { defaultChecked: "indeterminate" },
    props: { defaultChecked: "indeterminate" },
  },
  {
    name: "read-only",
    p: { readonly: true, defaultChecked: true },
    props: { readOnly: true, defaultChecked: true },
  },
  {
    name: "focusable-disabled",
    p: { disabled: true, focusableWhenDisabled: true },
    props: { disabled: true },
  },
  { name: "controlled, applying", p: null, props: {} },
] as const) {
  describe(`angular checkbox model: ${cfg.name}`, () => {
    testMachine(checkboxContract, {
      test: it,
      setup: () => {
        checkboxSteps.reset()
        current = cfg.p
        return mount(Terms)
      },
      target: () => screen,
      anchor: [{ name: "Accept terms" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: checkboxSteps.invariants,
      a11y,
    })
  })
}

describe("Angular Checkbox matches React", () => {
  it("states, flags, form attributes", async () => {
    const ps: P[] = [
      {},
      { defaultChecked: true },
      { defaultChecked: "indeterminate" },
      { disabled: true },
      { required: true, invalid: true },
      { uncheckedValue: "no", value: "yes", form: "f" },
    ]
    for (const p of ps) {
      current = p
      await both(reactTerms(p), Terms)
    }
  })
})
