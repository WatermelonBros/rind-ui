/** @jsxImportSource solid-js */
// The Switch contract model against the Solid parts (React's variants), and markup parity.
import { type CheckedState, platforms, switchContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, switchStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Switch, type SwitchRootProps } from "../index"

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
const wifi = (p: P): JSX.Element => (
  <form>
    <Switch.Root name="wifi" {...(p as SwitchRootProps)}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Wi-Fi</Switch.Label>
    </Switch.Root>
    <button type="reset">Reset</button>
  </form>
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
/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying() {
  const [checked, setChecked] = createSignal<CheckedState>(false)
  return wifi({
    get checked() {
      return checked() === true
    },
    onCheckedChange: (v: boolean) => setChecked(v),
  })
}

const switchSteps = switchStepInvariants()
for (const cfg of [
  { name: "uncontrolled", p: {}, props: {} },
  { name: "default checked", p: { defaultChecked: true }, props: { defaultChecked: true } },
  { name: "read-only", p: { readOnly: true }, props: { readOnly: true } },
  {
    name: "focusable-disabled",
    p: { disabled: true, focusableWhenDisabled: true },
    props: { disabled: true },
  },
  { name: "controlled, applying", p: null, props: {} },
]) {
  describe(`solid switch model: ${cfg.name}`, () => {
    testMachine(switchContract, {
      test: it,
      setup: () => {
        switchSteps.reset()
        return mount(() => withPlatform(() => (cfg.p ? wifi(cfg.p) : <Applying />)))
      },
      target: () => screen,
      anchor: [{ name: "Wi-Fi" }] as never,
      props: { ...base, ...cfg.props } as never,
      invariants: switchSteps.invariants,
      a11y,
    })
  })
}

describe("Solid Switch matches React", () => {
  it("states and flags", async () => {
    for (const p of [{}, { defaultChecked: true }, { readOnly: true }]) {
      await clientParity(reactWifi(p), () => wifi(p))
    }
  })
})
