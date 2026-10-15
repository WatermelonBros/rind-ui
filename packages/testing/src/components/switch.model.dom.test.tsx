// Model-based tests (task 5.1): the Switch contract over all transitions in pointer,
// keyboard, touch and virtual, with disabled and read-only configurations and the
// form-associated invariants; broken wrappers prove the invariants fail (4.2).
import { platforms, switchContract } from "@rind-ui/core"
import { RindProvider, Switch } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, switchStepInvariants, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine reads, as the component receives it.
const base = {
  checked: undefined,
  defaultChecked: undefined,
  onCheckedChange: undefined,
  disabled: undefined,
  readOnly: undefined,
}
const anchor = [{ name: "Wi-Fi" }] as never
const steps = switchStepInvariants()

type RootProps = Parameters<typeof Switch.Root>[0]
const withPlatform = (ui: ReactElement) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui}
  </RindProvider>
)
const WiFi = (props: Partial<RootProps> & { label?: string }) => {
  const { label = "Wi-Fi", ...rest } = props
  return (
    <form>
      <Switch.Root name="wifi" {...rest}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>{label}</Switch.Label>
      </Switch.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying() {
  const [checked, setChecked] = useState(false)
  return <WiFi checked={checked} onCheckedChange={setChecked} />
}

const configs = [
  { name: "uncontrolled", ui: () => <WiFi />, props: {} },
  { name: "default checked", ui: () => <WiFi defaultChecked />, props: { defaultChecked: true } },
  { name: "read-only", ui: () => <WiFi readOnly />, props: { readOnly: true } },
  {
    name: "focusable-disabled",
    ui: () => <WiFi disabled focusableWhenDisabled />,
    props: { disabled: true },
  },
  { name: "controlled, applying", ui: () => <Applying />, props: {} },
]

for (const cfg of configs) {
  describe(`switch model: ${cfg.name}`, () => {
    testMachine(switchContract, {
      test: it,
      setup: () => {
        steps.reset()
        return render(withPlatform(cfg.ui()))
      },
      target: () => screen,
      anchor,
      props: { ...base, ...cfg.props } as never,
      invariants: steps.invariants,
      a11y,
    })
  })
}

describe("switch model: controlled by the parent ($sync:checked)", () => {
  const ui = (checked: boolean) => withPlatform(<WiFi checked={checked} />)
  testMachine(switchContract, {
    test: it,
    setup: () => render(ui(false)),
    rerender: (next, rendered) => rendered.rerender(ui((next as { checked: boolean }).checked)),
    target: () => screen,
    anchor,
    props: { ...base, checked: false } as never,
    modalities: ["pointer"],
  })
})

async function failures(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(switchContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => {
      steps.reset()
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: base as never,
    invariants: steps.invariants,
    modalities: ["pointer"],
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

describe("broken Switches fail readably (4.2)", () => {
  it("mixed slips in → switch-aria-checked names the attribute", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <form>
        <Switch.Root>
          <Switch.Control aria-checked="mixed" />
          <Switch.Label>Wi-Fi</Switch.Label>
        </Switch.Root>
      </form>
    ))
    expect(out).toMatch(/switch-aria-checked: the control's aria-checked is "mixed"/)
  })

  it("a label that changes → switch-name-stable names both names", {
    timeout: 60_000,
  }, async () => {
    function Mute() {
      const [on, setOn] = useState(false)
      return (
        <form>
          <Switch.Root checked={on} onCheckedChange={setOn}>
            <Switch.Control aria-label={on ? "Unmute" : "Wi-Fi"} />
          </Switch.Root>
        </form>
      )
    }
    const out = await failures(() => <Mute />)
    expect(out).toMatch(
      /switch-name-stable: the name changed with the state: "Wi-Fi" → "Unmute"|Wi-Fi/,
    )
  })

  it("a visible thumb → switch-thumb-hidden", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <form>
        <Switch.Root>
          <Switch.Control>
            <Switch.Thumb aria-hidden="false" />
          </Switch.Control>
          <Switch.Label>Wi-Fi</Switch.Label>
        </Switch.Root>
      </form>
    ))
    expect(out).toMatch(/switch-thumb-hidden: the thumb is not aria-hidden/)
  })

  it("a double toggle per click → the step fails", { timeout: 60_000 }, async () => {
    let again = false
    const out = await failures(() => (
      <form>
        <Switch.Root>
          <Switch.Control
            onClick={(e) => {
              if (again) return
              again = true
              e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
              again = false
            }}
          />
          <Switch.Label>Wi-Fi</Switch.Label>
        </Switch.Root>
      </form>
    ))
    expect(out).toMatch(
      /expected (checked|unchecked)|virtual-parity|change events|data-focus-visible after a pointer step/,
    )
  })
})
