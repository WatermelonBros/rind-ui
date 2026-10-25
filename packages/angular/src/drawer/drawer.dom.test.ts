// The Drawer contract model (React's: modal, non-modal and closeOnSwipe false, both
// directions) against the Angular parts, and markup parity (snap points, handle, indent).
import { Component } from "@angular/core"
import {
  type DrawerSide,
  drawerContract,
  nonModalDrawerContract,
  type SnapPoint,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Drawer } from "./drawer"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface P {
  readonly defaultOpen?: boolean
  readonly modal?: boolean
  readonly closeOnSwipe?: boolean
  readonly side?: DrawerSide
  readonly snapPoints?: readonly SnapPoint[]
  readonly defaultSnapPoint?: SnapPoint
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean } = { p: {}, portal: true }

const FILL = { position: "fixed", inset: 0 }
const SHEET = { position: "fixed", insetInline: 0, bottom: 0, height: "400px" }
const FILL_CSS = "position: fixed; inset: 0px"
const SHEET_CSS = "position: fixed; inset-inline: 0px; bottom: 0px; height: 400px"

const PARTS = `<div rindDrawerBackdrop style="${FILL_CSS}"></div>
        <div rindDrawerPositioner style="${FILL_CSS}">
          <div rindDrawerContent style="${SHEET_CSS}">
            @if (d.handleIsButton()) {
              <button rindDrawerHandle></button>
            } @else {
              <div rindDrawerHandle></div>
            }
            <h2 rindDrawerTitle>Filters</h2>
            <p rindDrawerDescription>Narrow the list.</p>
            <button rindDrawerCloseTrigger>Done</button>
          </div>
        </div>`

@Component({
  selector: "rind-f",
  imports: [Drawer],
  template: `<div id="app">
    <div rindDrawerIndent><div rindDrawerIndentBackground></div></div>
    <ng-container
      rindDrawerRoot
      #d="rindDrawerRoot"
      [defaultOpen]="p.defaultOpen"
      [modal]="p.modal"
      [closeOnSwipe]="p.closeOnSwipe"
      [side]="p.side"
      [snapPoints]="p.snapPoints"
      [defaultSnapPoint]="p.defaultSnapPoint"
    >
      <button rindDrawerTrigger>Filters</button>
      @if (portal) {
        <ng-template rindDrawerPortal>${PARTS}</ng-template>
      } @else {
        ${PARTS}
      }
    </ng-container>
  </div>`,
})
class Tree {
  readonly p = current.p
  readonly portal = current.portal
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
  describe(`angular drawer model: ${name}`, () => {
    testMachine(modal ? drawerContract : nonModalDrawerContract, {
      test: it,
      setup: () => {
        current = { p: props, portal: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by the Root); the oracle only needs a value.
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

describe("Angular Drawer matches React", () => {
  for (const p of [
    {},
    { defaultOpen: true },
    { defaultOpen: true, modal: false },
    { defaultOpen: true, side: "inline-end" },
    { defaultOpen: true, snapPoints: [0.5, 1], defaultSnapPoint: 0.5 },
  ] as P[]) {
    for (const portal of [true, false]) {
      // In place: the content is inside the compared container.
      it(`${JSON.stringify(p)}, ${portal ? "portalled" : "in place"}`, async () => {
        current = { p, portal }
        await both(reactTree(p, portal), Tree)
      })
    }
  }
})
