// The Toggle contract's model-based test, unchanged from React's, against the Svelte parts.
import { toggleContract } from "@rind-ui/core"
import { getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import Controlled from "../../fixtures/toggle/controlled.svelte"
import Parts from "../../fixtures/toggle/parts.svelte"
import Basic from "../../fixtures/toggle/toggle.svelte"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const base = { pressed: undefined, defaultPressed: undefined, onPressedChange: undefined }
const anchor = [{ name: "Bold" }] as never

describe("svelte toggle model: uncontrolled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(Basic),
    target: () => screen,
    anchor,
    props: base as never,
    a11y,
  })
})

describe("svelte toggle model: starting on", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(Basic, { defaultPressed: true }),
    target: () => screen,
    anchor,
    props: { ...base, defaultPressed: true } as never,
    a11y,
  })
})

describe("svelte toggle model: controlled ($sync:pressed)", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(Controlled, { pressed: false }),
    rerender: (next, rendered) =>
      rendered.rerender({ pressed: (next as { pressed: boolean }).pressed }),
    target: () => screen,
    anchor,
    props: { ...base, pressed: false } as never,
    a11y,
  })
})

describe("svelte toggle parts", () => {
  it("bind:pressed, cancel vetoes, child snippet keeps behaviour, indicator follows", async () => {
    const changes: boolean[] = []
    const view = mount(Parts, { record: (v: boolean) => changes.push(v), veto: false })
    const t = getToggle(screen, { name: /Bold/ })
    const el = screen.getByRole("button", { name: /Bold/ })
    expect(el.tagName).toBe("A")
    expect(el.getAttribute("data-variant")).toBe("outline")
    expect(el.classList.contains("mine")).toBe(true)
    await t.setPressed(true)
    expect(el.getAttribute("aria-pressed")).toBe("true")
    expect(el.textContent).toContain("on")
    view.rerender({ veto: true })
    el.click()
    await Promise.resolve()
    expect(el.getAttribute("aria-pressed")).toBe("true")
    expect(changes).toEqual([true, false])
  })
})
