/** @jsxImportSource solid-js */
// The Popover contract model (React's matrix: modal false and true) against the Solid parts,
// and markup parity.
import { modalPopoverContract, platforms, popoverContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Popover, type PopoverRootProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const tree = (p: P, portal = true): JSX.Element => {
  const positioner = () => (
    <Popover.Positioner>
      <Popover.Content>
        <Popover.Arrow />
        <Popover.Title>Filters</Popover.Title>
        <Popover.Description>Narrow the list.</Popover.Description>
        <label>
          Search <input />
        </label>
        <Popover.CloseTrigger>Done</Popover.CloseTrigger>
      </Popover.Content>
    </Popover.Positioner>
  )
  return (
    <div id="app">
      <Popover.Root {...(p as PopoverRootProps)}>
        <Popover.Trigger>Filters</Popover.Trigger>
        {portal ? <Popover.Portal>{positioner()}</Popover.Portal> : positioner()}
      </Popover.Root>
      <button type="button">After</button>
    </div>
  )
}
const reactTree = (p: P, portal = true) => {
  const positioner = r(
    R.Popover.Positioner,
    null,
    r(
      R.Popover.Content,
      null,
      r(R.Popover.Arrow),
      r(R.Popover.Title, null, "Filters"),
      r(R.Popover.Description, null, "Narrow the list."),
      r("label", null, "Search ", r("input")),
      r(R.Popover.CloseTrigger, null, "Done"),
    ),
  )
  return r(
    "div",
    { id: "app" },
    r(
      R.Popover.Root,
      p,
      r(R.Popover.Trigger, null, "Filters"),
      portal ? r(R.Popover.Portal, null, positioner) : positioner,
    ),
    r("button", { type: "button" }, "After"),
  )
}
const ui = (p: P): JSX.Element => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {tree(p)}
  </RindProvider>
)

for (const modal of [false, true]) {
  describe(`solid popover model: ${modal ? "modal" : "non-modal"}`, () => {
    testMachine(modal ? modalPopoverContract : popoverContract, {
      test: it,
      setup: () => mount(() => ui({ modal })),
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by Popover.Root); the oracle only needs a value.
      props: {
        open: undefined,
        root: "oracle",
        modal,
        disabled: undefined,
        closeOnEscape: undefined,
        closeOnInteractOutside: undefined,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Solid Popover matches React", () => {
  it("closed, open, modal, keep mounted", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { defaultOpen: true, modal: true },
      { keepMounted: true },
    ] as P[]) {
      await clientParity(reactTree(p), () => tree(p))
      // In place: the open content is inside the compared container.
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
