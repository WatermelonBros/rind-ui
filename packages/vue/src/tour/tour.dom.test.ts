// The Tour contract model (React's: modal false and true) against the Vue parts, and markup
// parity with React (closed; the trigger with the tour's parts mounted).
import { modalTourContract, tourContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Tour, type TourStepDef } from "../index"

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

const example = (p: Record<string, unknown>) => () =>
  h("div", { id: "app" }, [
    h("button", { type: "button", id: "search" }, "Search"),
    h("div", { id: "toolbar", style: { width: "120px", height: "30px" } }, [
      h("button", { type: "button" }, "Bold"),
    ]),
    h("button", { type: "button", id: "after" }, "After"),
    h(Tour.Root, { steps, ...p }, () => [
      h(Tour.Trigger, null, () => "Take the tour"),
      h(Tour.Portal, null, () => [
        h(Tour.Backdrop),
        h(Tour.Spotlight),
        h(Tour.Positioner, null, () =>
          h(Tour.Content, null, () => [
            h(Tour.Arrow),
            h(Tour.Title),
            h(Tour.Description),
            h(Tour.ProgressText),
            h(Tour.Actions, null, {
              default: (actions: readonly { action: unknown }[]) =>
                actions.map((a) =>
                  h(Tour.ActionTrigger, { key: String(a.action), action: a as never }),
                ),
            }),
            h(Tour.CloseTrigger),
          ]),
        ),
      ]),
    ]),
  ])
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
  describe(`vue tour model: ${modal ? "modal" : "default"}`, () => {
    testMachine(modal ? modalTourContract : tourContract, {
      test: it,
      setup: () => mount(example({ modal })),
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

describe("Vue Tour matches React", () => {
  it("closed", async () => {
    for (const p of [{ id: "t" }, { id: "t", modal: true }]) {
      await serverParity(reactExample(p), example(p))
      await clientParity(reactExample(p), example(p))
    }
  })
  it("open at the first (centred) step", async () => {
    await clientParity(
      reactExample({ id: "t", defaultOpen: true }),
      example({ id: "t", defaultOpen: true }),
    )
  })
})
