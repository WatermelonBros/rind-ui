// The Popover contract model (React's matrix: modal false and true) against the Angular parts,
// and markup parity.
import { Component } from "@angular/core"
import { modalPopoverContract, platforms, popoverContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Popover } from "./popover"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface P {
  readonly modal?: boolean
  readonly defaultOpen?: boolean
  readonly keepMounted?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean; provider: boolean } = { p: {}, portal: true, provider: false }

const POSITIONER = `<div rindPopoverPositioner>
          <div rindPopoverContent>
            <div rindPopoverArrow></div>
            <h2 rindPopoverTitle>Filters</h2>
            <p rindPopoverDescription>Narrow the list.</p>
            <label>Search <input /></label>
            <button rindPopoverCloseTrigger>Done</button>
          </div>
        </div>`
const TREE = `<div id="app">
      <ng-container
        rindPopoverRoot
        [modal]="p.modal"
        [defaultOpen]="p.defaultOpen"
        [keepMounted]="p.keepMounted ?? false"
      >
        <button rindPopoverTrigger>Filters</button>
        @if (portal) {
          <ng-template rindPopoverPortal>${POSITIONER}</ng-template>
        } @else {
          ${POSITIONER}
        }
      </ng-container>
      <button type="button">After</button>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Popover],
  template: `@if (provider) {
      <ng-container rindProvider [environment]="env">${TREE}</ng-container>
    } @else {
      ${TREE}
    }`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly p = current.p
  readonly portal = current.portal
  readonly provider = current.provider
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

for (const modal of [false, true]) {
  describe(`angular popover model: ${modal ? "modal" : "non-modal"}`, () => {
    testMachine(modal ? modalPopoverContract : popoverContract, {
      test: it,
      setup: () => {
        current = { p: { modal }, portal: true, provider: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by the Root); the oracle only needs a value.
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

describe("Angular Popover matches React", () => {
  for (const p of [
    {},
    { defaultOpen: true },
    { defaultOpen: true, modal: true },
    { keepMounted: true },
  ] as P[]) {
    for (const portal of [true, false]) {
      // In place: the open content is inside the compared container.
      it(`${JSON.stringify(p)}, ${portal ? "portalled" : "in place"}`, async () => {
        current = { p, portal, provider: false }
        await both(reactTree(p, portal), Tree)
      })
    }
  }
})
