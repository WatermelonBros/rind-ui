// Model-based tests (add-tour 6.1): the tour contract over every transition in pointer, touch,
// keyboard and virtual, for modal false and true, with the layer, restores-focus, presence,
// anchored and (modal) modal invariants and axe per state. The fixture has a centred step,
// anchored steps and a step with an asynchronous effect (so `preparing` is a real phase).
import { modalTourContract, tourContract } from "@rind-ui/core"
import { Tour, type TourStepDef } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine } from "../index"

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

function Example({ modal }: { readonly modal: boolean }) {
  return (
    <div id="app">
      <button type="button" id="search">
        Search
      </button>
      <div id="toolbar" style={{ width: 120, height: 30 }}>
        <button type="button">Bold</button>
      </div>
      <button type="button" id="after">
        After
      </button>
      <Tour.Root steps={steps} modal={modal}>
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
                {(actions) =>
                  actions.map((a) => <Tour.ActionTrigger key={String(a.action)} action={a} />)
                }
              </Tour.Actions>
              <Tour.CloseTrigger />
            </Tour.Content>
          </Tour.Positioner>
        </Tour.Portal>
      </Tour.Root>
    </div>
  )
}

for (const modal of [false, true]) {
  describe(`tour model: ${modal ? "modal" : "default"}`, () => {
    testMachine(modal ? modalTourContract : tourContract, {
      test: it,
      setup: () => render(<Example modal={modal} />),
      target: () => screen,
      anchor: [{ name: "Take the tour" }] as never,
      // `root`, `messages` and the callbacks are internal (set by Tour.Root); the oracle only
      // needs the steps and the flags its guards read.
      props: {
        open: undefined,
        root: "oracle",
        steps,
        modal,
        closeOnEscape: undefined,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}
