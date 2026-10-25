// The HoverCard contract model (React's: every mapped transition in pointer, keyboard, touch and
// virtual, on a virtual clock) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { hoverCardContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { HoverCard } from "./hover-card"

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
  readonly keepMounted?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean; clock: boolean } = { p: {}, portal: true, clock: false }

const POSITIONER = `<div rindHoverCardPositioner>
          <div rindHoverCardContent>
            <div rindHoverCardArrow></div>
            <p>Designer in Lisbon.</p>
            <button type="button">Follow</button>
          </div>
        </div>`
const TREE = `<div id="app">
      <a href="/before">Before</a>
      <ng-container
        rindHoverCardRoot
        [openDelay]="200"
        [closeDelay]="100"
        [defaultOpen]="p.defaultOpen"
        [keepMounted]="p.keepMounted ?? false"
      >
        <a rindHoverCardTrigger href="/u/jane">Jane Doe</a>
        @if (portal) {
          <ng-template rindHoverCardPortal>${POSITIONER}</ng-template>
        } @else {
          ${POSITIONER}
        }
      </ng-container>
      <a href="/after">After</a>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, HoverCard],
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
    R.HoverCard.Positioner,
    null,
    r(
      R.HoverCard.Content,
      null,
      r(R.HoverCard.Arrow),
      r("p", null, "Designer in Lisbon."),
      r("button", { type: "button" }, "Follow"),
    ),
  )
  return r(
    "div",
    { id: "app" },
    r("a", { href: "/before" }, "Before"),
    r(
      R.HoverCard.Root,
      { openDelay: 200, closeDelay: 100, ...p },
      r(R.HoverCard.Trigger, { href: "/u/jane" }, "Jane Doe"),
      portal ? r(R.HoverCard.Portal, null, positioner) : positioner,
    ),
    r("a", { href: "/after" }, "After"),
  )
}

describe("angular hover card model", () => {
  testMachine(hoverCardContract, {
    test: it,
    setup: () => {
      current = { p: {}, portal: true, clock: true }
      return mount(Tree)
    },
    target: () => screen,
    anchor: [{ name: "Jane Doe" }] as never,
    // `root` is internal (set by the Root); the oracle only needs a value.
    props: {
      open: undefined,
      root: "oracle",
      disabled: undefined,
      openDelay: 200,
      closeDelay: 100,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    clock,
    a11y,
  })
})

describe("Angular Hover Card matches React", () => {
  for (const p of [{}, { defaultOpen: true }, { keepMounted: true }] as P[]) {
    for (const portal of [true, false]) {
      // In place: the content is inside the compared container.
      it(`${JSON.stringify(p)}, ${portal ? "portalled" : "in place"}`, async () => {
        current = { p, portal, clock: false }
        await both(reactTree(p, portal), Tree)
      })
    }
  }
})
