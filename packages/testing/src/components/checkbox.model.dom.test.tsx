// Model-based tests (task 7.1): the Checkbox contract over the configurations of design §6
// (uncontrolled, indeterminate default, read-only, focusable-disabled, controlled), in every
// modality, with the form-associated invariants on every step; broken variants (7.2).
import { type CheckedState, checkboxContract, platforms } from "@rind-ui/core"
import { Checkbox, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, expect, it } from "vitest"
import { checkboxStepInvariants, currentRun, domEnv, getCheckbox, testMachine } from "../index"

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
const anchor = [{ name: "Accept terms" }] as never
const steps = checkboxStepInvariants()

type RootProps = Parameters<typeof Checkbox.Root>[0]
const withPlatform = (ui: ReactElement) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui}
  </RindProvider>
)
const Terms = (props: Partial<RootProps>) => (
  <form>
    <Checkbox.Root name="tos" {...props}>
      <Checkbox.Control>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Accept terms</Checkbox.Label>
      <Checkbox.Description>Required to continue</Checkbox.Description>
    </Checkbox.Root>
    <button type="reset">Reset</button>
  </form>
)

/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying(props: Partial<RootProps>) {
  const [checked, setChecked] = useState<CheckedState>(false)
  return <Terms {...props} checked={checked} onCheckedChange={(v) => setChecked(v)} />
}

const configs: { name: string; ui: () => ReactElement; props: Record<string, unknown> }[] = [
  { name: "uncontrolled", ui: () => <Terms />, props: {} },
  {
    name: "indeterminate default",
    ui: () => <Terms defaultChecked="indeterminate" />,
    props: { defaultChecked: "indeterminate" },
  },
  {
    name: "read-only",
    ui: () => <Terms readOnly defaultChecked />,
    props: { readOnly: true, defaultChecked: true },
  },
  {
    name: "focusable-disabled",
    ui: () => <Terms disabled focusableWhenDisabled />,
    props: { disabled: true },
  },
  { name: "controlled, applying", ui: () => <Applying />, props: {} },
]

for (const cfg of configs) {
  describe(`checkbox model: ${cfg.name}`, () => {
    testMachine(checkboxContract, {
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

describe("checkbox model: controlled by the parent ($sync:checked)", () => {
  const ui = (checked: CheckedState) => withPlatform(<Terms checked={checked} />)
  testMachine(checkboxContract, {
    test: it,
    setup: () => render(ui(false)),
    rerender: (next, rendered) =>
      rendered.rerender(ui((next as { checked: CheckedState }).checked)),
    target: () => screen,
    anchor,
    props: { ...base, checked: false } as never,
    modalities: ["pointer"],
  })
})

/** Every failure message of the contract run on a broken variant. */
async function failures(ui: () => ReactElement, props: Record<string, unknown> = {}) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(checkboxContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => {
      steps.reset()
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: { ...base, ...props } as never,
    invariants: steps.invariants,
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

describe("broken Checkboxes fail readably (7.2)", () => {
  it("toggles on Enter → checkbox-enter-never-changes", { timeout: 60_000 }, async () => {
    render(
      <Checkbox.Root>
        <Checkbox.Control
          onKeyDown={(e) => {
            // Broken: the consumer toggles on Enter.
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
          }}
        />
        <Checkbox.Label>Accept terms</Checkbox.Label>
      </Checkbox.Root>,
    )
    steps.reset()
    await getCheckbox(screen, { name: "Accept terms" }).part("control").press("Enter")
    const result = await steps.invariants[0]?.check({} as never)
    expect(result).toMatch(/Enter on the control changed aria-checked/)
  })

  it("a synthetic click from the hidden input → form-associated click count", {
    timeout: 60_000,
  }, async () => {
    const out = await failures(() => (
      <Terms
        onCheckedChange={() => {
          // Broken: the old Radix way, a click from the input on every change.
          const input = document.querySelector("[data-part=hidden-input]") as HTMLInputElement
          input.dispatchEvent(new MouseEvent("click", { bubbles: true }))
        }}
      />
    ))
    expect(out).toMatch(/received \d+ click events/)
  })

  it("change on a programmatic update → form-associated change count", {
    timeout: 60_000,
  }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    const ui = (checked: boolean) => (
      <Terms
        checked={checked}
        ref={(el) => {
          // Broken: a change event whenever the parent sets the value.
          const input = el?.querySelector("[data-part=hidden-input]")
          if (input && (input as HTMLInputElement).checked !== checked) {
            queueMicrotask(() => input.dispatchEvent(new Event("change", { bubbles: true })))
          }
        }}
      />
    )
    testMachine(checkboxContract, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () => render(ui(false)),
      rerender: (next, rendered) => rendered.rerender(ui((next as { checked: boolean }).checked)),
      target: () => domEnv({ timeout: 200 }),
      anchor,
      props: { ...base, checked: false } as never,
      modalities: ["pointer"],
    })
    const out: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => out.push(e.message))
      document.body.innerHTML = ""
    }
    expect(out.join("\n")).toMatch(/dispatched \d+ change events for 0 user changes/)
  })

  it("a double toggle per click → the step fails", { timeout: 60_000 }, async () => {
    // A label click is absorbed by press.ts's label forwarding (one activation), so the
    // double toggle is produced on the Control: a second, bare click per click.
    let again = false
    const out = await failures(() => (
      <form>
        <Checkbox.Root name="tos">
          <Checkbox.Control
            onClick={(e) => {
              if (again) return
              again = true
              e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
              again = false
            }}
          />
          <Checkbox.Label>Accept terms</Checkbox.Label>
        </Checkbox.Root>
        <button type="reset">Reset</button>
      </form>
    ))
    expect(out).toMatch(
      /expected (checked|unchecked)|virtual-parity|change events|data-focus-visible after a pointer step/,
    )
  })

  it("a focusable hidden input → form-associated tabIndex", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <Terms
        ref={(el) => {
          el?.querySelector("[data-part=hidden-input]")?.setAttribute("tabindex", "0")
        }}
      />
    ))
    expect(out).toMatch(/has tabIndex 0/)
  })
})
