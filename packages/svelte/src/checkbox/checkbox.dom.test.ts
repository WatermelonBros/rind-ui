// Checkbox and Switch: React's contract models against the Svelte parts, and DOM parity.
import { checkboxContract, switchContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { checkboxStepInvariants, switchStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Toggles from "../../fixtures/checkbox/toggles.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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
type P = Record<string, unknown>

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
]) {
  describe(`svelte checkbox model: ${cfg.name}`, () => {
    testMachine(checkboxContract, {
      test: it,
      setup: () => {
        checkboxSteps.reset()
        return mount(Toggles, (cfg.p ? { root: cfg.p } : { applying: true }) as never)
      },
      target: () => screen,
      anchor: [{ name: "Accept terms" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: checkboxSteps.invariants,
      a11y,
    })
  })
}

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
]) {
  describe(`svelte switch model: ${cfg.name}`, () => {
    testMachine(switchContract, {
      test: it,
      setup: () => {
        switchSteps.reset()
        return mount(
          Toggles,
          (cfg.p ? { kind: "switch", root: cfg.p } : { kind: "switch", applying: true }) as never,
        )
      },
      target: () => screen,
      anchor: [{ name: "Wi-Fi" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: switchSteps.invariants,
      a11y,
    })
  })
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
describe("Svelte Checkbox and Switch match React", () => {
  it("states, flags, form attributes", async () => {
    for (const p of [
      {},
      { defaultChecked: true },
      { defaultChecked: "indeterminate" },
      { disabled: true },
      { required: true, invalid: true },
      { uncheckedValue: "no", value: "yes", form: "f" },
    ]) {
      await clientParity(reactTerms(p), Toggles, { root: p, provider: false } as never)
    }
    for (const p of [{}, { defaultChecked: true }]) {
      await clientParity(reactWifi(p), Toggles, {
        kind: "switch",
        root: p,
        provider: false,
      } as never)
    }
    await clientParity(reactWifi({ readOnly: true }), Toggles, {
      kind: "switch",
      root: { readonly: true },
      provider: false,
    } as never)
  })
})
