import { platforms } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../../src/index"
import { disclosureContract } from "./disclosure.contract"
import { DisclosureExample } from "./disclosure.fixture"
import { Disclosure } from "./disclosure.react"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    // jsdom has no layout or canvas: contrast is checked by the Storybook browser run.
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) {
    throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
  }
}

// Every prop the machine's guards read, as the rendered component receives it.
const props = { closeOnEscape: undefined, autoCloseMs: undefined }

describe("disclosure model", () => {
  // Every modality, both directions, both platform presets (add-a11y-foundations 13.1).
  testMachine(disclosureContract, {
    test: it,
    setup: () => render(<DisclosureExample />),
    target: () => screen,
    anchor: ["Details"],
    props,
    a11y,
    directions: ["ltr", "rtl"],
    platforms: [platforms.apple, platforms.windows],
  })
})

describe("disclosure model, controlled", () => {
  testMachine(disclosureContract, {
    test: it,
    setup: () => render(<DisclosureExample open={false} />),
    rerender: (next, rendered) => rendered.rerender(<DisclosureExample {...next} />),
    target: () => screen,
    anchor: ["Details"],
    props: { ...props, open: false },
    modalities: ["keyboard"],
  })
})

describe("disclosure model, Escape disabled", () => {
  testMachine(disclosureContract, {
    test: it,
    setup: () => render(<DisclosureExample closeOnEscape={false} />),
    target: () => screen,
    anchor: ["Details"],
    props: { ...props, closeOnEscape: false },
    modalities: ["keyboard"],
  })
})

/** Runs testMachine with a collecting registrar; returns each test's failure (or null). */
async function failuresOf(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(disclosureContract, {
    test: (name, fn) => tests.push({ name, fn }),
    props,
    setup: () => render(ui()),
    // A short timeout: these paths are expected to fail.
    target: () => domEnv({ timeout: 200 }),
    anchor: ["Details"],
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

describe("broken variants fail with readable reports", () => {
  it("missing aria-expanded and content left visible", { timeout: 20_000 }, async () => {
    const results = await failuresOf(() => (
      <Disclosure.Root>
        <Disclosure.Trigger render={(props) => <button {...props} aria-expanded={undefined} />}>
          Details
        </Disclosure.Trigger>
        <Disclosure.Content render={(props) => <div {...props} hidden={false} />}>
          Body text
        </Disclosure.Content>
      </Disclosure.Root>
    ))
    const failed = results.filter((r) => r.error)
    expect(failed.length).toBeGreaterThan(0)
    const report = failed[0]?.error ?? ""
    expect(report).toMatch(/failed (at step|in the initial state)/)
    expect(report).toMatch(/modality: /)
    expect(report).toMatch(/path so far: closed/)
    expect(report).toMatch(/contentVisible|still visible/)
  })

  it("a trigger wired to pointerdown fails the virtual path", { timeout: 20_000 }, async () => {
    const results = await failuresOf(() => (
      <Disclosure.Root>
        <Disclosure.Trigger
          render={({ onClick, ...props }) => (
            <button {...props} onPointerDown={onClick as () => void} />
          )}
        >
          Details
        </Disclosure.Trigger>
        <Disclosure.Content>Body text</Disclosure.Content>
      </Disclosure.Root>
    ))
    const virtual = results.filter((r) => r.name.includes("[virtual]"))
    expect(virtual.length).toBeGreaterThan(0)
    expect(virtual.every((r) => r.error?.includes("[virtual]"))).toBe(true)
    const pointer = results.filter((r) => r.name.includes("[pointer]"))
    expect(pointer.every((r) => r.error === null)).toBe(true)
  })
})
