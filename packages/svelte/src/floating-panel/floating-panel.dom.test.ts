// Floating Panel's Svelte parts: a non-modal dialog named by its Title; keys on the DragTrigger
// move and resize; the stage trigger minimises and restores; an outside press keeps it open and
// Close closes it; bind:position; DOM parity with React. Drags: the React browser suite.
import * as R from "@rind-ui/react"
import { getFloatingPanel } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Panel from "../../fixtures/floating-panel/panel.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const settle = async () => {
  await Promise.resolve()
  flushSync()
}

function setup(root: Record<string, unknown> = { defaultOpen: true }) {
  const m = mount(Panel, { root } as never)
  return { ...m, d: () => getFloatingPanel(document.body) }
}

describe("Svelte FloatingPanel", () => {
  it("a non-modal dialog named by the Title; keys move and resize", async () => {
    const t = setup()
    await settle()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute("aria-labelledby")).toBe(
      document.querySelector('[data-part="title"]')?.id,
    )
    expect(dialog?.hasAttribute("aria-modal")).toBe(false)
    expect(await t.d().position()).toEqual({ x: 40, y: 40 })
    await t.d().moveBy(20, 10)
    expect(await t.d().position()).toEqual({ x: 60, y: 50 })
    await t.d().resizeBy(10, 0)
    expect(await t.d().size()).toEqual({ width: 370, height: 240 })
  })

  it("the stage trigger minimises (Body hidden) and restores", async () => {
    const t = setup()
    await settle()
    await t.d().via("pointer").minimize()
    expect(document.querySelector<HTMLElement>('[data-part="body"]')?.hidden).toBe(true)
    await t.d().via("pointer").restore()
    expect(await t.d().stage()).toBe("default")
  })

  it("opens from the Trigger; an outside press keeps it open; Close closes it", async () => {
    const t = setup({})
    await settle()
    await t.d().via("pointer").open()
    const outside = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Outside",
    )
    outside?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    outside?.click()
    await settle()
    expect(await t.d().isOpen()).toBe(true)
    await t.d().via("pointer").close()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("bind:position follows the keys", async () => {
    const onBound = vi.fn()
    const m = mount(Panel, { onBound } as never)
    await settle()
    await getFloatingPanel(m.host).moveBy(10, 0)
    flushSync()
    expect(onBound).toHaveBeenLastCalledWith({ x: 10, y: 0 })
  })

  it("matches React's DOM", async () => {
    const react = r(
      R.FloatingPanel.Root,
      { defaultOpen: true, defaultPosition: { x: 10, y: 20 } },
      r(
        R.FloatingPanel.Positioner,
        { key: "p" },
        r(
          R.FloatingPanel.Content,
          null,
          r(
            R.FloatingPanel.Header,
            { key: "h" },
            r(R.FloatingPanel.DragTrigger, { key: "d" }, "⠿"),
            r(R.FloatingPanel.Title, { key: "t" }, "Notes"),
          ),
          r(R.FloatingPanel.Body, { key: "b" }, "Body"),
        ),
      ),
    )
    await clientParity(react, Panel, { full: false } as never)
  })
})
