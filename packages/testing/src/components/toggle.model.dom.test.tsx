// Model-based tests: the Toggle contract over both edges in pointer, touch, keyboard and
// virtual, uncontrolled and controlled (5.1), and broken variants that must fail readably
// (5.2).
import { platforms, toggleContract } from "@rind-ui/core"
import { RindProvider, ToggleGroup } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, expectRindWarning, getToggle, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const base = { pressed: undefined, defaultPressed: undefined, onPressedChange: undefined }
const anchor = [{ name: "Bold" }] as never
const withPlatform = (ui: ReactElement) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui}
  </RindProvider>
)

describe("toggle model: uncontrolled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => render(withPlatform(<ToggleGroup.Item>Bold</ToggleGroup.Item>)),
    target: () => screen,
    anchor,
    props: base as never,
    a11y,
  })
})

describe("toggle model: starting on", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => render(withPlatform(<ToggleGroup.Item defaultPressed>Bold</ToggleGroup.Item>)),
    target: () => screen,
    anchor,
    props: { ...base, defaultPressed: true } as never,
    a11y,
  })
})

describe("toggle model: controlled ($sync:pressed)", () => {
  const ui = (pressed: boolean) =>
    withPlatform(<ToggleGroup.Item pressed={pressed}>Bold</ToggleGroup.Item>)
  testMachine(toggleContract, {
    test: it,
    setup: () => render(ui(false)),
    rerender: (next, rendered) => rendered.rerender(ui((next as { pressed: boolean }).pressed)),
    target: () => screen,
    anchor,
    props: { ...base, pressed: false } as never,
    a11y,
  })
})

// activateWithEnter is keyboard-only and not the PRESS mapping: its own path (design).
describe("toggle: activateWithEnter on both edges", () => {
  it("off → on → off with Enter", async () => {
    render(withPlatform(<ToggleGroup.Item>Bold</ToggleGroup.Item>))
    const t = getToggle(screen, { name: "Bold" }).via("keyboard")
    await t.activateWithEnter(true)
    expect(await t.isPressed()).toBe(true)
    await t.activateWithEnter(false)
    expect(await t.isPressed()).toBe(false)
  })
})

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(toggleContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(ui()),
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: base as never,
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    document.body.innerHTML = ""
    out.push({ name: t.name, error })
  }
  return out
}

describe("broken Toggles fail readably", () => {
  it("a label that changes with the state → the anchor is lost", { timeout: 60_000 }, async () => {
    // the broken or partial setup this test exercises logs it
    expectRindWarning(/toggle: the accessible name changed with the state/)
    const results = await failures(() => (
      <ToggleGroup.Item
        render={(p, s) => <button {...p}>{s.pressed ? "Not bold" : "Bold"}</button>}
      />
    ))
    expect(
      results.some((r) => /Bold/.test(r.error ?? "") && /match|found/i.test(r.error ?? "")),
    ).toBe(true)
  })

  it("aria-pressed absent when off → the attrs check fails", { timeout: 60_000 }, async () => {
    const results = await failures(() => (
      <ToggleGroup.Item
        render={(p) => (
          <button {...p} aria-pressed={p["aria-pressed"] === "true" ? "true" : undefined}>
            Bold
          </button>
        )}
      />
    ))
    expect(results.some((r) => /aria-pressed/.test(r.error ?? ""))).toBe(true)
  })

  it("a double toggle on a bare click → virtual parity", { timeout: 60_000 }, async () => {
    let again = false
    const results = await failures(() => (
      <ToggleGroup.Item
        // Broken: a second activation for clicks with detail 0.
        onClick={(e) => {
          if (e.detail !== 0 || again) return
          again = true
          e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
          again = false
        }}
      >
        Bold
      </ToggleGroup.Item>
    ))
    const virtual = results.filter((r) => r.name.includes("[virtual"))
    expect(virtual.some((r) => r.error !== null)).toBe(true)
  })
})
