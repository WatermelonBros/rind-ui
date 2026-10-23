// Checkbox and Switch: React's contract models against the Vue parts, and markup parity.
import { type CheckedState, checkboxContract, platforms, switchContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  checkboxStepInvariants,
  currentRun,
  switchStepInvariants,
  testMachine,
} from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { type ReactElement, createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, ref, type VNode } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Checkbox, RindProvider, Switch } from "../index"

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
const withPlatform = (ui: () => VNode) =>
  h(RindProvider, { environment: { platform: currentRun()?.platform ?? platforms.linux } }, ui)

const terms = (p: P) =>
  h("form", null, [
    h(Checkbox.Root, { name: "tos", ...p }, () => [
      h(Checkbox.Control, null, () => h(Checkbox.Indicator, null, () => "✓")),
      h(Checkbox.Label, null, () => "Accept terms"),
      h(Checkbox.Description, null, () => "Required to continue"),
    ]),
    h("button", { type: "reset" }, "Reset"),
  ])
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
const wifi = (p: P) =>
  h("form", null, [
    h(Switch.Root, { name: "wifi", ...p }, () => [
      h(Switch.Control, null, () => h(Switch.Thumb)),
      h(Switch.Label, null, () => "Wi-Fi"),
    ]),
    h("button", { type: "reset" }, "Reset"),
  ])
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
/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
const applying = (ui: (p: P) => VNode, initial: CheckedState) =>
  defineComponent({
    setup() {
      const checked = ref<CheckedState>(initial)
      return () =>
        ui({ checked: checked.value, "onUpdate:checked": (v: CheckedState) => (checked.value = v) })
    },
  })

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
  describe(`vue checkbox model: ${cfg.name}`, () => {
    testMachine(checkboxContract, {
      test: it,
      setup: () => {
        checkboxSteps.reset()
        const Applying = applying(terms, false)
        return mount(() => withPlatform(() => (cfg.p ? terms(cfg.p) : h(Applying))))
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
  describe(`vue switch model: ${cfg.name}`, () => {
    testMachine(switchContract, {
      test: it,
      setup: () => {
        switchSteps.reset()
        const Applying = applying(wifi, false)
        return mount(() => withPlatform(() => (cfg.p ? wifi(cfg.p) : h(Applying))))
      },
      target: () => screen,
      anchor: [{ name: "Wi-Fi" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: switchSteps.invariants,
      a11y,
    })
  })
}

const both = async (react: ReactElement, vue: () => VNode) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}
describe("Vue Checkbox and Switch match React", () => {
  it("states, flags, form attributes", async () => {
    for (const p of [
      {},
      { defaultChecked: true },
      { defaultChecked: "indeterminate" },
      { disabled: true },
      { required: true, invalid: true },
      { uncheckedValue: "no", value: "yes", form: "f" },
    ]) {
      await both(reactTerms(p), () => terms(p))
    }
    for (const p of [{}, { defaultChecked: true }, { readonly: true }]) {
      await both(
        reactWifi({ ...p, ...("readonly" in p ? { readOnly: true, readonly: undefined } : {}) }),
        () => wifi(p),
      )
    }
  })
})
