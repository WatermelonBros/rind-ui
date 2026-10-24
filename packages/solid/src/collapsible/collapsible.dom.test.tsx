/** @jsxImportSource solid-js */
// The Collapsible contract model (React's matrix) against the Solid parts, the closing cases
// (content stays mounted until its exit ends) and markup parity.
import { type ClosedContent, collapsibleContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Collapsible, type CollapsibleRootProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  disabled: undefined,
  focusOutOfContent: undefined,
}
const anchor = [{ name: "Details" }] as never
type P = Record<string, unknown>
const tree = (p: P): JSX.Element => (
  <Collapsible.Root {...(p as CollapsibleRootProps)}>
    <Collapsible.Trigger>
      Details <Collapsible.Indicator />
    </Collapsible.Trigger>
    <Collapsible.Content>
      <a href="#more">More</a>
    </Collapsible.Content>
  </Collapsible.Root>
)
const reactTree = (p: P) =>
  r(
    R.Collapsible.Root,
    p,
    r(R.Collapsible.Trigger, null, "Details ", r(R.Collapsible.Indicator)),
    r(R.Collapsible.Content, null, r("a", { href: "#more" }, "More")),
  )
const ui = (p: P): JSX.Element => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {tree(p)}
  </RindProvider>
)

for (const closedContent of ["until-found", "hidden", "unmount"] as readonly ClosedContent[]) {
  for (const disabled of [false, true]) {
    for (const defaultOpen of [false, true]) {
      describe(`solid collapsible model: ${closedContent}, disabled ${disabled}, open ${defaultOpen}`, () => {
        testMachine(collapsibleContract, {
          test: it,
          setup: () => mount(() => ui({ closedContent, disabled, defaultOpen })),
          target: () => screen,
          anchor,
          props: { ...base, disabled, defaultOpen } as never,
          a11y,
        })
      })
    }
  }
}

describe("solid collapsible model: controlled ($sync:open)", () => {
  testMachine(collapsibleContract, {
    test: it,
    setup: () => mount(ui, { open: false }),
    rerender: (next, rendered) => rendered.rerender({ open: (next as { open: boolean }).open }),
    target: () => screen,
    anchor,
    props: { ...base, open: false } as never,
    a11y,
    modalities: ["pointer"],
  })
})

describe("solid collapsible closing", () => {
  it("unmount mode removes the content after closing; reopening mounts it again", async () => {
    mount(() => tree({ closedContent: "unmount", defaultOpen: true }))
    const trigger = screen.getByRole("button", { name: /Details/ })
    expect(screen.queryByText("More")).not.toBeNull()
    trigger.click()
    await vi.waitFor(() => expect(screen.queryByText("More")).toBeNull())
    trigger.click()
    await vi.waitFor(() => expect(screen.queryByText("More")).not.toBeNull())
  })

  it("hidden mode keeps the content in the DOM, hidden once closed", async () => {
    mount(() => tree({ closedContent: "hidden", defaultOpen: true }))
    const trigger = screen.getByRole("button", { name: /Details/ })
    const content = screen.getByText("More").parentElement as HTMLElement
    expect(content.hasAttribute("hidden")).toBe(false)
    trigger.click()
    await vi.waitFor(() => expect(content.hasAttribute("hidden")).toBe(true))
    expect(content.isConnected).toBe(true)
  })
})

describe("Solid Collapsible matches React", () => {
  it("closed modes, open, disabled", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { closedContent: "hidden" },
      { closedContent: "unmount" },
      { disabled: true, focusableWhenDisabled: true },
    ]) {
      await clientParity(reactTree(p), () => tree(p))
    }
  })
})
