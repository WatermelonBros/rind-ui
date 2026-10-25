// The Tooltip contract model (React's: every mapped transition in pointer, keyboard, touch and
// virtual, on a virtual clock) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { tooltipContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Tooltip } from "./tooltip"

// The delays run on a virtual clock: the runner advances it, no real time passes.
const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface P {
  readonly defaultOpen?: boolean
  readonly type?: "description" | "label"
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean; clock: boolean } = { p: {}, portal: true, clock: false }

const POSITIONER = `<div rindTooltipPositioner>
          <div rindTooltipContent><div rindTooltipArrow></div>Delete permanently</div>
        </div>`
const TREE = `<div id="app">
      <button type="button">Before</button>
      <ng-container
        rindTooltipRoot
        [openDelay]="200"
        [closeDelay]="100"
        [defaultOpen]="p.defaultOpen"
        [type]="p.type ?? 'description'"
      >
        <button rindTooltipTrigger>Delete</button>
        @if (portal) {
          <ng-template rindTooltipPortal>${POSITIONER}</ng-template>
        } @else {
          ${POSITIONER}
        }
      </ng-container>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Tooltip],
  template: `@if (clock) {
      <ng-container rindProvider [environment]="env">${TREE}</ng-container>
    } @else {
      ${TREE}
    }`,
})
class Tree {
  readonly env = { scheduler: clock.scheduler }
  readonly p = current.p
  readonly portal = current.portal
  readonly clock = current.clock
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

describe("angular tooltip model", () => {
  testMachine(tooltipContract, {
    test: it,
    setup: () => {
      current = { p: {}, portal: true, clock: true }
      return mount(Tree)
    },
    target: () => screen,
    anchor: [{ name: "Delete" }] as never,
    // `root` is internal (set by the Root); the oracle only needs a value.
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

describe("Angular Tooltip matches React", () => {
  for (const p of [{}, { defaultOpen: true }, { type: "label", defaultOpen: true }] as P[]) {
    for (const portal of [true, false]) {
      // In place: the content is inside the compared container.
      it(`${JSON.stringify(p)}, ${portal ? "portalled" : "in place"}`, async () => {
        current = { p, portal, clock: false }
        await both(reactTree(p, portal), Tree)
      })
    }
  }
})
