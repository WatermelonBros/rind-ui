// The Toggle contract's model-based test, unchanged from React's, against the Vue parts.
import { platforms, toggleContract } from "@rind-ui/core"
import { currentRun, getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider, Toggle } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const base = { pressed: undefined, defaultPressed: undefined, onPressedChange: undefined }
const anchor = [{ name: "Bold" }] as never
const withPlatform = (ui: () => ReturnType<typeof h>) =>
  h(RindProvider, { environment: { platform: currentRun()?.platform ?? platforms.linux } }, ui)

describe("vue toggle model: uncontrolled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(() => withPlatform(() => h(Toggle.Root, null, () => "Bold"))),
    target: () => screen,
    anchor,
    props: base as never,
    a11y,
  })
})

describe("vue toggle model: starting on", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () =>
      mount(() => withPlatform(() => h(Toggle.Root, { defaultPressed: true }, () => "Bold"))),
    target: () => screen,
    anchor,
    props: { ...base, defaultPressed: true } as never,
    a11y,
  })
})

describe("vue toggle model: controlled ($sync:pressed)", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () =>
      mount(
        (p: { pressed: boolean }) =>
          withPlatform(() => h(Toggle.Root, { pressed: p.pressed }, () => "Bold")),
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

describe("vue toggle parts", () => {
  it("v-model:pressed, cancel vetoes, asChild keeps behaviour, indicator follows", async () => {
    const changes: boolean[] = []
    let veto = false
    const view = mount(
      (p: { pressed: boolean }) =>
        h(
          Toggle.Root,
          {
            pressed: p.pressed,
            asChild: true,
            "data-variant": "outline",
            onPressedChange: (v: boolean, d: { cancel(): void }) => {
              changes.push(v)
              if (veto) d.cancel()
            },
            "onUpdate:pressed": (v: boolean) => view.rerender({ pressed: v }),
          },
          () =>
            h("a", { href: "#", class: "mine" }, [
              "Bold",
              h(Toggle.Indicator, null, { default: () => "on", fallback: () => "off" }),
            ]),
        ),
      { pressed: false },
    )
    const t = getToggle(screen, { name: /Bold/ })
    const el = screen.getByRole("button", { name: /Bold/ })
    expect(el.tagName).toBe("A")
    expect(el.getAttribute("data-variant")).toBe("outline")
    expect(el.classList.contains("mine")).toBe(true)
    await t.setPressed(true)
    await vi.waitFor(() => expect(el.getAttribute("aria-pressed")).toBe("true"))
    expect(el.textContent).toContain("on")
    veto = true
    el.click()
    await Promise.resolve()
    expect(el.getAttribute("aria-pressed")).toBe("true")
    expect(changes).toEqual([true, false])
  })
})
