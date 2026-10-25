/** @jsxImportSource solid-js */
// The Tour contract model (React's: modal false and true) against the Solid parts, and markup
// parity with React (closed; the trigger with the tour's parts mounted).
import { modalTourContract, tourContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Tour, type TourRootProps, type TourStepDef } from "../index"

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

type P = Record<string, unknown>
const example = (p: P): JSX.Element => (
  <div id="app">
    <button type="button" id="search">
      Search
    </button>
    <div id="toolbar" style={{ width: "120px", height: "30px" }}>
      <button type="button">Bold</button>
    </div>
    <button type="button" id="after">
      After
    </button>
    <Tour.Root {...({ steps, ...p } as TourRootProps)}>
      <Tour.Trigger>Take the tour</Tour.Trigger>
      <Tour.Portal>
        <Tour.Backdrop />
        <Tour.Spotlight />
        <Tour.Positioner>
          <Tour.Content>
            <Tour.Arrow />
            <Tour.Title />
            <Tour.Description />
            <Tour.ProgressText />
            <Tour.Actions>
              {(actions) => <For each={actions}>{(a) => <Tour.ActionTrigger action={a} />}</For>}
            </Tour.Actions>
            <Tour.CloseTrigger />
          </Tour.Content>
        </Tour.Positioner>
      </Tour.Portal>
    </Tour.Root>
  </div>
)
const reactExample = (p: P) =>
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
  describe(`solid tour model: ${modal ? "modal" : "default"}`, () => {
    testMachine(modal ? modalTourContract : tourContract, {
      test: it,
      setup: () => mount(() => example({ modal })),
      target: () => screen,
      anchor: [{ name: "Take the tour" }] as never,
      // `root`, `messages` and the callbacks are internal (set by Tour.Root); the oracle only
      // needs the steps and the flags its guards read.
      props: { open: undefined, root: "oracle", steps, modal, closeOnEscape: undefined } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Solid Tour matches React", () => {
  it("closed", async () => {
    for (const p of [{ id: "t" }, { id: "t", modal: true }]) {
      await clientParity(reactExample(p), () => example(p))
    }
  })
  it("open at the first (centred) step", async () => {
    await clientParity(reactExample({ id: "t", defaultOpen: true }), () =>
      example({ id: "t", defaultOpen: true }),
    )
  })
})
