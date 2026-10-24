// The Popover contract model (React's matrix: modal false and true) against the Vue parts, and
// markup parity.
import { modalPopoverContract, platforms, popoverContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Popover, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const tree = (p: P, portal = true) => {
  const positioner = () =>
    h(Popover.Positioner, null, () =>
      h(Popover.Content, null, () => [
        h(Popover.Arrow),
        h(Popover.Title, null, () => "Filters"),
        h(Popover.Description, null, () => "Narrow the list."),
        h("label", null, ["Search ", h("input")]),
        h(Popover.CloseTrigger, null, () => "Done"),
      ]),
    )
  return h("div", { id: "app" }, [
    h(Popover.Root, p, () => [
      h(Popover.Trigger, null, () => "Filters"),
      portal ? h(Popover.Portal, null, positioner) : positioner(),
    ]),
    h("button", { type: "button" }, "After"),
  ])
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
const ui = (p: P) =>
  h(RindProvider, { environment: { platform: currentRun()?.platform ?? platforms.linux } }, () =>
    tree(p),
  )

for (const modal of [false, true]) {
  describe(`vue popover model: ${modal ? "modal" : "non-modal"}`, () => {
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

describe("Vue Popover matches React", () => {
  it("closed, open, modal, keep mounted", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { defaultOpen: true, modal: true },
      { keepMounted: true },
    ] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
      // In place: the open content is inside the compared container.
      await serverParity(reactTree(p, false), () => tree(p, false))
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
