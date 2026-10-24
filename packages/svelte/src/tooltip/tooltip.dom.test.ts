// The Tooltip contract model (React's: every mapped transition in pointer, keyboard, touch and
// virtual, on a virtual clock) against the Svelte parts, and DOM parity.
import { tooltipContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Delete from "../../fixtures/tooltip/delete.svelte"

// The delays run on a virtual clock: the runner advances it, no real time passes.
const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const reactTree = (p: P, portal = true) => {
  const positioner = r(
    R.Tooltip.Positioner,
    null,
    r(R.Tooltip.Content, null, r(R.Tooltip.Arrow), "Delete permanently"),
  )
  return r(
    "div",
    { id: "app" },
    r("button", { type: "button" }, "Before"),
    r(
      R.Tooltip.Root,
      { openDelay: 200, closeDelay: 100, ...p },
      r(R.Tooltip.Trigger, null, "Delete"),
      portal ? r(R.Tooltip.Portal, null, positioner) : positioner,
    ),
  )
}

describe("svelte tooltip model", () => {
  testMachine(tooltipContract, {
    test: it,
    setup: () => mount(Delete, { scheduler: clock.scheduler } as never),
    target: () => screen,
    anchor: [{ name: "Delete" }] as never,
    // `root` is internal (set by Tooltip.Root); the oracle only needs a value.
    props: {
      open: undefined,
      root: "oracle",
      disabled: undefined,
      openDelay: 200,
      closeDelay: 100,
      closeOnPress: undefined,
      skipDelay: undefined,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    clock,
    a11y,
  })
})

describe("Svelte Tooltip matches React", () => {
  it("closed, open, label", async () => {
    for (const p of [{}, { defaultOpen: true }, { type: "label", defaultOpen: true }] as P[]) {
      await clientParity(reactTree(p), Delete, { root: p } as never)
      // In place: the content is inside the compared container.
      await clientParity(reactTree(p, false), Delete, { root: p, portal: false } as never)
    }
  })
})
