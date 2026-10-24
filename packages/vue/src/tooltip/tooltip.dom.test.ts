// The Tooltip contract model (React's: every mapped transition in pointer, keyboard, touch and
// virtual, on a virtual clock) against the Vue parts, and markup parity.
import { tooltipContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, Tooltip } from "../index"

// The delays run on a virtual clock: the runner advances it, no real time passes.
const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const tree = (p: P, portal = true) => {
  const positioner = () =>
    h(Tooltip.Positioner, null, () =>
      h(Tooltip.Content, null, () => [h(Tooltip.Arrow), "Delete permanently"]),
    )
  return h("div", { id: "app" }, [
    h("button", { type: "button" }, "Before"),
    h(Tooltip.Root, { openDelay: 200, closeDelay: 100, ...p }, () => [
      h(Tooltip.Trigger, null, () => "Delete"),
      portal ? h(Tooltip.Portal, null, positioner) : positioner(),
    ]),
  ])
}
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

describe("vue tooltip model", () => {
  testMachine(tooltipContract, {
    test: it,
    setup: () =>
      mount(() => h(RindProvider, { environment: { scheduler: clock.scheduler } }, () => tree({}))),
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

describe("Vue Tooltip matches React", () => {
  it("closed, open, label", async () => {
    for (const p of [{}, { defaultOpen: true }, { type: "label", defaultOpen: true }] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
      // In place: the content is inside the compared container.
      await serverParity(reactTree(p, false), () => tree(p, false))
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
