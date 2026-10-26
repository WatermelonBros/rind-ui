// Floating Panel's Vue parts: a non-modal dialog named by its Title; keys on the DragTrigger move
// and resize; the stage triggers minimise and restore; an outside press keeps it open and the
// Close button closes it; v-model:position; markup parity with React. Drags: React browser suite.
import * as R from "@rind-ui/react"
import { getFloatingPanel } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h, nextTick, ref } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { FloatingPanel, RindProvider } from "../index"

const panel = (root: Record<string, unknown> = {}) =>
  h(FloatingPanel.Root, { defaultPosition: { x: 40, y: 40 }, ...root }, () => [
    h(FloatingPanel.Trigger, null, () => "Open notes"),
    h(FloatingPanel.Positioner, null, () => [
      h(FloatingPanel.Content, null, () => [
        h(FloatingPanel.Header, null, () => [
          h(FloatingPanel.DragTrigger, null, () => "⠿"),
          h(FloatingPanel.Title, null, () => "Notes"),
          h(FloatingPanel.Control, null, () => [
            h(FloatingPanel.StageTrigger, { stage: "minimized" }, () => "_"),
            h(FloatingPanel.CloseTrigger, null, () => "×"),
          ]),
        ]),
        h(FloatingPanel.Body, null, () => "Body"),
      ]),
    ]),
  ])

function setup(root: Record<string, unknown> = { defaultOpen: true }) {
  const m = mount(() =>
    h(RindProvider, null, () => [panel(root), h("button", { type: "button" }, "Outside")]),
  )
  return { ...m, d: () => getFloatingPanel(document.body) }
}

const settle = async () => {
  await nextTick()
  await nextTick()
}

describe("Vue FloatingPanel", () => {
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

  it("v-model:position follows the keys", async () => {
    const position = ref({ x: 0, y: 0 })
    const m = mount(() =>
      h(RindProvider, null, () =>
        panel({
          defaultOpen: true,
          position: position.value,
          "onUpdate:position": (p: { x: number; y: number }) => (position.value = p),
        }),
      ),
    )
    await settle()
    await getFloatingPanel(m.host).moveBy(10, 0)
    expect(position.value).toEqual({ x: 10, y: 0 })
  })

  it("matches React's markup, server and client", async () => {
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
    const vue = () =>
      h(FloatingPanel.Root, { defaultOpen: true, defaultPosition: { x: 10, y: 20 } }, () => [
        h(FloatingPanel.Positioner, null, () => [
          h(FloatingPanel.Content, null, () => [
            h(FloatingPanel.Header, null, () => [
              h(FloatingPanel.DragTrigger, null, () => "⠿"),
              h(FloatingPanel.Title, null, () => "Notes"),
            ]),
            h(FloatingPanel.Body, null, () => "Body"),
          ]),
        ]),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
