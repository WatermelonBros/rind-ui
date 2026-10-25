/** @jsxImportSource solid-js */
// The Drawer contract model (React's: modal, non-modal and closeOnSwipe false, both
// directions) against the Solid parts, and markup parity (snap points, handle, indent).
import { drawerContract, nonModalDrawerContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Drawer, type DrawerRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const FILL = { position: "fixed", inset: "0" } as const
const SHEET = { position: "fixed", "inset-inline": "0", bottom: "0", height: "400px" } as const

const tree = (p: P, portal = true): JSX.Element => {
  const parts = () => (
    <>
      <Drawer.Backdrop style={FILL} />
      <Drawer.Positioner style={FILL}>
        <Drawer.Content style={SHEET}>
          <Drawer.Handle />
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Description>Narrow the list.</Drawer.Description>
          <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
        </Drawer.Content>
      </Drawer.Positioner>
    </>
  )
  return (
    <div id="app">
      <Drawer.Indent>
        <Drawer.IndentBackground />
      </Drawer.Indent>
      <Drawer.Root {...(p as DrawerRootProps)}>
        <Drawer.Trigger>Filters</Drawer.Trigger>
        {portal ? <Drawer.Portal>{parts()}</Drawer.Portal> : parts()}
      </Drawer.Root>
    </div>
  )
}
const reactTree = (p: P, portal = true) => {
  const fill = { position: "fixed", inset: 0 } as never
  const parts = [
    r(R.Drawer.Backdrop, { key: "b", style: fill }),
    r(
      R.Drawer.Positioner,
      { key: "p", style: fill },
      r(
        R.Drawer.Content,
        {
          style: {
            position: "fixed",
            insetInline: 0,
            bottom: 0,
            height: 400,
          } as never,
        },
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
  describe(`solid drawer model: ${name}`, () => {
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

describe("Solid Drawer matches React", () => {
  it("closed, open, non-modal, side, snap points", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { defaultOpen: true, modal: false },
      { defaultOpen: true, side: "inline-end" },
      { defaultOpen: true, snapPoints: [0.5, 1], defaultSnapPoint: 0.5 },
    ] as P[]) {
      await clientParity(reactTree(p), () => tree(p))
      // In place: the content is inside the compared container.
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
