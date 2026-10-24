// The Drawer contract model (React's: modal, non-modal and closeOnSwipe false, both
// directions) against the Vue parts, and markup parity (snap points, handle, indent).
import { drawerContract, nonModalDrawerContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Drawer } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const FILL = { position: "fixed", inset: 0 }
const SHEET = { position: "fixed", insetInline: 0, bottom: 0, height: "400px" }

const tree = (p: P, portal = true) => {
  const parts = () => [
    h(Drawer.Backdrop, { style: FILL }),
    h(Drawer.Positioner, { style: FILL }, () =>
      h(Drawer.Content, { style: SHEET }, () => [
        h(Drawer.Handle),
        h(Drawer.Title, null, () => "Filters"),
        h(Drawer.Description, null, () => "Narrow the list."),
        h(Drawer.CloseTrigger, null, () => "Done"),
      ]),
    ),
  ]
  return h("div", { id: "app" }, [
    h(Drawer.Indent, null, () => h(Drawer.IndentBackground)),
    h(Drawer.Root, p, () => [
      h(Drawer.Trigger, null, () => "Filters"),
      portal ? h(Drawer.Portal, null, parts) : parts(),
    ]),
  ])
}
const reactTree = (p: P, portal = true) => {
  const parts = [
    r(R.Drawer.Backdrop, { key: "b", style: FILL as never }),
    r(
      R.Drawer.Positioner,
      { key: "p", style: FILL as never },
      r(
        R.Drawer.Content,
        { style: { ...SHEET, height: 400 } as never },
        r(R.Drawer.Handle),
        r(R.Drawer.Title, null, "Filters"),
        r(R.Drawer.Description, null, "Narrow the list."),
        r(R.Drawer.CloseTrigger, null, "Done"),
      ),
    ),
  ]
  return r(
    "div",
    { id: "app" },
    r(R.Drawer.Indent, null, r(R.Drawer.IndentBackground)),
    r(
      R.Drawer.Root,
      p as never,
      r(R.Drawer.Trigger, null, "Filters"),
      portal ? r(R.Drawer.Portal, null, parts) : parts,
    ),
  )
}

const sets: { name: string; props: P; modal: boolean }[] = [
  { name: "modal", props: {}, modal: true },
  { name: "non-modal", props: { modal: false }, modal: false },
  { name: "closeOnSwipe false", props: { closeOnSwipe: false }, modal: true },
]
for (const { name, props, modal } of sets) {
  describe(`vue drawer model: ${name}`, () => {
    testMachine(modal ? drawerContract : nonModalDrawerContract, {
      test: it,
      setup: () => mount(() => tree(props)),
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by Drawer.Root); the oracle only needs a value.
      props: {
        open: undefined,
        root: "oracle",
        role: undefined,
        modal: undefined,
        closeOnEscape: undefined,
        closeOnInteractOutside: undefined,
        closeOnSwipe: undefined,
        snapPoints: undefined,
        side: undefined,
        dir: undefined,
        swipeThreshold: undefined,
        swipeVelocityThreshold: undefined,
        defaultSnapPoint: undefined,
        snapToSequentialPoints: undefined,
        ...props,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      directions: ["ltr", "rtl"],
      a11y,
    })
  })
}

describe("Vue Drawer matches React", () => {
  it("closed, open, non-modal, side, snap points", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { defaultOpen: true, modal: false },
      { defaultOpen: true, side: "inline-end" },
      { defaultOpen: true, snapPoints: [0.5, 1], defaultSnapPoint: 0.5 },
    ] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
      // In place: the content is inside the compared container.
      await serverParity(reactTree(p, false), () => tree(p, false))
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
