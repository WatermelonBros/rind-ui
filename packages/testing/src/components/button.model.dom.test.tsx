// Model-based tests: the Button contract in every modality, with the props variants the
// machine's guards read (5.1), and broken variants that must fail readably (5.2).
import { buttonContract, platforms } from "@rind-ui/core"
import { Button, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ComponentProps } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, installAnnouncementLog, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const withPlatform = (ui: React.ReactNode) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui}
  </RindProvider>
)
const runs = {
  directions: ["ltr", "rtl"] as const,
  platforms: [platforms.apple, platforms.windows],
}

// Every prop the machine's guards and values read, as the component receives it.
type ButtonProps = ComponentProps<typeof Button>
const base = { disabled: undefined, pending: undefined }
const anchor = [{ name: "Save" }] as never

/** Counts onPress calls, for the runner's activation parity (one press, one onPress). */
let presses = 0
const onPress = () => {
  presses += 1
}
const activations = { action: "notifyPress", count: () => presses }

function variant(name: string, buttonProps: ButtonProps, extra = {}) {
  describe(`button model: ${name}`, () => {
    testMachine(buttonContract, {
      test: it,
      setup: () =>
        render(
          withPlatform(
            <Button {...buttonProps} onPress={onPress}>
              Save
            </Button>,
          ),
        ),
      activations,
      target: () => screen,
      anchor,
      props: { ...base, ...buttonProps } as never,
      a11y,
      ...extra,
    })
  })
}

variant("default", {}, runs)
variant("submit", { type: "submit" })
variant("reset", { type: "reset" })
variant("disabled", { disabled: true })
variant("focusableWhenDisabled", { disabled: true, focusableWhenDisabled: true })
variant("pending", { pending: true })
variant("render div", { render: <div /> })

describe("button model: pending edges through rerender ($sync:pending)", () => {
  const ui = (props: ButtonProps) => withPlatform(<Button {...props}>Save</Button>)
  testMachine(buttonContract, {
    test: it,
    setup: () => render(ui({ pending: false })),
    rerender: (next, rendered) => rendered.rerender(ui(next as unknown as ButtonProps)),
    target: () => screen,
    anchor,
    props: { ...base, pending: false } as never,
    a11y,
    modalities: ["keyboard", "pointer"],
  })
})

describe("button model: pending edges, starting pending", () => {
  const ui = (props: ButtonProps) => withPlatform(<Button {...props}>Save</Button>)
  testMachine(buttonContract, {
    test: it,
    setup: () => render(ui({ pending: true })),
    rerender: (next, rendered) => rendered.rerender(ui(next as unknown as ButtonProps)),
    target: () => screen,
    anchor,
    props: { ...base, pending: true } as never,
    modalities: ["pointer"],
  })
})

// ---- 5.2: broken variants fail with a readable report ------------------------------------

async function failuresOf(
  ui: () => React.ReactElement,
  props: Record<string, unknown>,
  counted?: typeof activations,
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(buttonContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(ui()),
    ...(counted ? { activations: counted } : {}),
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: props as never,
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    document.body.innerHTML = ""
    installAnnouncementLog().length = 0
    out.push({ name: t.name, error })
  }
  return out
}

describe("broken Buttons fail with the invariant's name", () => {
  // The runner counts onPress calls per step (`activations`) against the oracle.
  it("double onPress on a bare click → virtual parity", { timeout: 60_000 }, async () => {
    let again = false
    const results = await failuresOf(
      () => (
        <Button
          onPress={onPress}
          // Broken: a second activation for clicks with detail 0.
          onClick={(e) => {
            if (e.detail !== 0 || again) return
            again = true
            e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
            again = false
          }}
        >
          Save
        </Button>
      ),
      base,
      activations,
    )
    const virtual = results.filter((r) => r.name.includes("[virtual"))
    expect(virtual.length).toBeGreaterThan(0)
    expect(virtual.some((r) => r.error?.includes("virtual-parity"))).toBe(true)
  })

  it("ring after a mouse click → focus-visible-modality", { timeout: 60_000 }, async () => {
    const results = await failuresOf(
      () => (
        <Button
          // Broken: shows the ring whenever focused, whatever the input.
          onFocus={(e) => e.currentTarget.setAttribute("data-focus-visible", "")}
        >
          Save
        </Button>
      ),
      base,
    )
    const pointer = results.filter((r) => r.name.includes("[pointer"))
    expect(pointer.some((r) => r.error?.includes("data-focus-visible after a pointer step"))).toBe(
      true,
    )
  })

  it("focusableWhenDisabled still activating → fails", { timeout: 60_000 }, async () => {
    const results = await failuresOf(
      () => (
        <Button
          disabled
          focusableWhenDisabled
          // Broken: the consumer re-enables activation through a native click.
          onClick={(e) => e.currentTarget.removeAttribute("aria-disabled")}
          onFocus={(e) => e.currentTarget.removeAttribute("aria-disabled")}
        >
          Save
        </Button>
      ),
      { ...base, disabled: true, focusableWhenDisabled: true },
    )
    // The disabled state must be observable as disabled after every step.
    expect(results.some((r) => r.error !== null)).toBe(true)
    expect(results.some((r) => /isDisabled|disabled/i.test(r.error ?? ""))).toBe(true)
  })
})
