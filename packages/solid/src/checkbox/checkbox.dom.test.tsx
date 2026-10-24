/** @jsxImportSource solid-js */
// The Checkbox contract model against the Solid parts (React's variants), the form integration
// and markup parity with @rind-ui/react.
import { type CheckedState, checkboxContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { checkboxStepInvariants, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Checkbox, type CheckboxRootProps, RindProvider } from "../index"

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
const withPlatform = (ui: () => JSX.Element) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui()}
  </RindProvider>
)

// `p` may carry getters: a spread keeps them reactive.
const terms = (p: P): JSX.Element => (
  <form>
    <Checkbox.Root name="tos" {...(p as CheckboxRootProps)}>
      <Checkbox.Control>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Accept terms</Checkbox.Label>
      <Checkbox.Description>Required to continue</Checkbox.Description>
    </Checkbox.Root>
    <button type="reset">Reset</button>
  </form>
)
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
/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying() {
  const [checked, setChecked] = createSignal<CheckedState>(false)
  return terms({
    get checked() {
      return checked()
    },
    onCheckedChange: (v: CheckedState) => setChecked(v),
  })
}

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
    p: { readOnly: true, defaultChecked: true },
    props: { readOnly: true, defaultChecked: true },
  },
  {
    name: "focusable-disabled",
    p: { disabled: true, focusableWhenDisabled: true },
    props: { disabled: true },
  },
  { name: "controlled, applying", p: null, props: {} },
]) {
  describe(`solid checkbox model: ${cfg.name}`, () => {
    testMachine(checkboxContract, {
      test: it,
      setup: () => {
        checkboxSteps.reset()
        return mount(() => withPlatform(() => (cfg.p ? terms(cfg.p) : <Applying />)))
      },
      target: () => screen,
      anchor: [{ name: "Accept terms" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: checkboxSteps.invariants,
      a11y,
    })
  })
}

describe("Solid Checkbox matches React", () => {
  it("states, flags, form attributes", async () => {
    for (const p of [
      {},
      { defaultChecked: true },
      { defaultChecked: "indeterminate" },
      { disabled: true },
      { required: true, invalid: true },
      { uncheckedValue: "no", value: "yes", form: "f" },
    ]) {
      await clientParity(reactTerms(p), () => terms(p))
    }
  })

  it("submits its value while checked, nothing (or uncheckedValue) while not; reset restores", async () => {
    mount(() => (
      <form>
        <Checkbox.Root name="tos" value="yes" uncheckedValue="no" defaultChecked>
          <Checkbox.Control />
          <Checkbox.Label>Accept</Checkbox.Label>
        </Checkbox.Root>
        <button type="reset">Reset</button>
      </form>
    ))
    const control = screen.getByRole("checkbox", { name: "Accept" })
    const form = control.closest("form") as HTMLFormElement
    const sent = () => new FormData(form).getAll("tos")
    expect(sent()).toEqual(["yes"])
    control.click()
    await vi.waitFor(() => expect(control.getAttribute("aria-checked")).toBe("false"))
    expect(sent()).toEqual(["no"])
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(control.getAttribute("aria-checked")).toBe("true"))
    expect(sent()).toEqual(["yes"])
  })
})
