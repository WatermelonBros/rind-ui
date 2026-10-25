// The Tour contract model (React's: modal false and true) against the Angular parts, and markup
// parity with React (closed; the trigger with the tour's parts mounted).
import { Component } from "@angular/core"
import { modalTourContract, tourContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { Tour, type TourStepDef } from "./index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const byId = (id: string) => () => document.getElementById(id)
const nav = [
  { action: "prev" as const },
  { action: "next" as const },
  { action: "skip" as const, label: "Skip" },
]
const steps: TourStepDef[] = [
  { id: "welcome", title: "Welcome", description: "A short tour.", actions: nav },
  { id: "search", title: "Search", target: byId("search"), actions: nav },
  {
    id: "toolbar",
    title: "Toolbar",
    target: byId("toolbar"),
    actions: nav,
    // Ready on the next microtask: a real `preparing` phase without any timer.
    effect: async ({ show }) => {
      await Promise.resolve()
      show()
    },
  },
  { id: "done", title: "That's it", target: byId("after"), actions: nav },
]

/** The configuration the next example renders. */
let current: { id?: string; modal?: boolean; defaultOpen?: boolean } = {}

@Component({
  selector: "rind-f",
  imports: [Tour],
  template: `<div id="app">
    <button type="button" id="search">Search</button>
    <div id="toolbar" style="width: 120px; height: 30px"><button type="button">Bold</button></div>
    <button type="button" id="after">After</button>
    <ng-container rindTourRoot [steps]="steps" [id]="p.id" [modal]="p.modal" [defaultOpen]="p.defaultOpen">
      <button rindTourTrigger>Take the tour</button>
      <ng-template rindTourPortal>
        <div rindTourBackdrop></div>
        <div rindTourSpotlight></div>
        <div rindTourPositioner>
          <div rindTourContent>
            <div rindTourArrow></div>
            <h2 rindTourTitle></h2>
            <p rindTourDescription></p>
            <span rindTourProgressText></span>
            <ng-template rindTourActions let-actions>
              @for (a of actions; track a.action) {
                <button rindTourActionTrigger [action]="a"></button>
              }
            </ng-template>
            <button rindTourCloseTrigger></button>
          </div>
        </div>
      </ng-template>
    </ng-container>
  </div>`,
})
class Example {
  readonly p = current
  readonly steps = steps
}

const reactExample = (p: Record<string, unknown>) =>
  r(
    "div",
    { id: "app" },
    r("button", { type: "button", id: "search" }, "Search"),
    r(
      "div",
      { id: "toolbar", style: { width: 120, height: 30 } },
      r("button", { type: "button" }, "Bold"),
    ),
    r("button", { type: "button", id: "after" }, "After"),
    r(
      R.Tour.Root,
      { steps, ...p } as never,
      r(R.Tour.Trigger, null, "Take the tour"),
      r(
        R.Tour.Portal,
        null,
        r(R.Tour.Backdrop),
        r(R.Tour.Spotlight),
        r(
          R.Tour.Positioner,
          null,
          r(
            R.Tour.Content,
            null,
            r(R.Tour.Arrow),
            r(R.Tour.Title),
            r(R.Tour.Description),
            r(R.Tour.ProgressText),
            r(
              R.Tour.Actions,
              null,
              // Sound: Actions takes a render function as its children.
              ((actions: readonly { action: unknown }[]) =>
                actions.map((a) =>
                  r(R.Tour.ActionTrigger, { key: String(a.action), action: a as never }),
                )) as never,
            ),
            r(R.Tour.CloseTrigger),
          ),
        ),
      ),
    ),
  )

for (const modal of [false, true]) {
  describe(`angular tour model: ${modal ? "modal" : "default"}`, () => {
    testMachine(modal ? modalTourContract : tourContract, {
      test: it,
      setup: () => {
        current = { modal }
        return mount(Example)
      },
      target: () => screen,
      anchor: [{ name: "Take the tour" }] as never,
      // `root`, `messages` and the callbacks are internal (set by the Root); the oracle only
      // needs the steps and the flags its guards read.
      props: { open: undefined, root: "oracle", steps, modal, closeOnEscape: undefined } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Angular Tour matches React", () => {
  for (const p of [{ id: "t" }, { id: "t", modal: true }]) {
    it(`closed ${JSON.stringify(p)}`, async () => {
      current = p
      await both(reactExample(p), Example)
    })
  }
  it("open at the first (centred) step", async () => {
    current = { id: "t", defaultOpen: true }
    await clientParity(reactExample(current), Example)
  })
})
