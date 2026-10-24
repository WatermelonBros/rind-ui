/** @jsxImportSource solid-js */
// The Toggle contract's model-based test, unchanged from React's, against the Solid parts; the
// Solid idioms (callbacks, render, reactive props); markup parity with React.
import { platforms, toggleContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Toggle } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const base = { pressed: undefined, defaultPressed: undefined, onPressedChange: undefined }
const anchor = [{ name: "Bold" }] as never
const withPlatform = (ui: () => JSX.Element) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {ui()}
  </RindProvider>
)

describe("solid toggle model: uncontrolled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(() => withPlatform(() => <Toggle.Root>Bold</Toggle.Root>)),
    target: () => screen,
    anchor,
    props: base as never,
    a11y,
  })
})

describe("solid toggle model: starting on", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(() => withPlatform(() => <Toggle.Root defaultPressed>Bold</Toggle.Root>)),
    target: () => screen,
    anchor,
    props: { ...base, defaultPressed: true } as never,
    a11y,
  })
})

describe("solid toggle model: controlled ($sync:pressed)", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () =>
      mount(
        (p: { pressed: boolean }) =>
          withPlatform(() => <Toggle.Root pressed={p.pressed}>Bold</Toggle.Root>),
        { pressed: false },
      ),
    rerender: (next, rendered) =>
      rendered.rerender({ pressed: (next as { pressed: boolean }).pressed }),
    target: () => screen,
    anchor,
    props: { ...base, pressed: false } as never,
    a11y,
  })
})

describe("solid toggle parts", () => {
  it("callbacks, cancel vetoes, render keeps behaviour, indicator follows", async () => {
    const changes: boolean[] = []
    let veto = false
    const [pressed, setPressed] = createSignal(false)
    mount(() => (
      <Toggle.Root
        pressed={pressed()}
        data-variant="outline"
        onPressedChange={(v, d) => {
          changes.push(v)
          if (veto) d.cancel()
          else setPressed(v)
        }}
        render={(props) => <a href="#bold" class="mine" {...props} />}
      >
        Bold
        <Toggle.Indicator fallback="off">on</Toggle.Indicator>
      </Toggle.Root>
    ))
    const t = getToggle(screen, { name: /Bold/ })
    const el = screen.getByRole("button", { name: /Bold/ })
    expect(el.tagName).toBe("A")
    expect(el.getAttribute("data-variant")).toBe("outline")
    expect(el.classList.contains("mine")).toBe(true)
    expect(el.textContent).toContain("off")
    await t.setPressed(true)
    await vi.waitFor(() => expect(el.getAttribute("aria-pressed")).toBe("true"))
    expect(el.textContent).toContain("on")
    veto = true
    el.click()
    await Promise.resolve()
    expect(el.getAttribute("aria-pressed")).toBe("true")
    expect(changes).toEqual([true, false])
  })

  it("a consumer prop changed after mount reaches the element; both handlers run", async () => {
    const [described, setDescribed] = createSignal<string | undefined>(undefined)
    const clicks: string[] = []
    mount(() => (
      <Toggle.Root aria-describedby={described()} onClick={() => clicks.push("consumer")}>
        Bold
      </Toggle.Root>
    ))
    const el = screen.getByRole("button", { name: "Bold" })
    expect(el.hasAttribute("aria-describedby")).toBe(false)
    setDescribed("hint")
    expect(el.getAttribute("aria-describedby")).toBe("hint")
    el.click()
    await vi.waitFor(() => expect(el.getAttribute("aria-pressed")).toBe("true"))
    expect(clicks).toEqual(["consumer"])
    expect(screen.getByRole("button", { name: "Bold" })).toBe(el)
  })
})

describe("Solid Toggle matches React", () => {
  it("toggle states and indicator", async () => {
    await clientParity(r(R.Toggle.Root, null, "Bold"), () => <Toggle.Root>Bold</Toggle.Root>)
    await clientParity(
      r(
        R.Toggle.Root,
        { defaultPressed: true, disabled: true },
        "Bold",
        r(R.Toggle.Indicator, null, "✓"),
      ),
      () => (
        <Toggle.Root defaultPressed disabled>
          Bold
          <Toggle.Indicator>✓</Toggle.Indicator>
        </Toggle.Root>
      ),
    )
  })
})
