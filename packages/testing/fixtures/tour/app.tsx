// The page tour.pw.test.ts drives: a themed three-step tour (a centred welcome, two anchored
// steps), bundled by the test itself (no Storybook, no site build).
import { Tour, type TourStepDef } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const nav = [
  { action: "prev" as const, label: "Back" },
  { action: "next" as const, label: "Next" },
]
const byId = (id: string) => () => document.getElementById(id)

const steps: TourStepDef[] = [
  { id: "welcome", title: "Welcome", description: "Three quick steps.", actions: nav },
  {
    id: "search",
    title: "Search",
    description: "Find any file.",
    target: byId("search"),
    actions: nav,
  },
  { id: "toolbar", title: "Toolbar", target: byId("toolbar"), side: "top", actions: nav },
]

function App() {
  return (
    <div style={{ display: "grid", gap: 48, padding: 48, justifyItems: "start" }}>
      <label>
        Search <input id="search" />
      </label>
      <div id="toolbar" style={{ display: "flex", gap: 8 }}>
        <button type="button">Bold</button>
        <button type="button">Italic</button>
      </div>
      <Tour.Root steps={steps}>
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
                  actions.map((a) => <Tour.ActionTrigger key={String(a.label)} action={a} />)
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

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
