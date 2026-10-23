"use client"

import { TextField, Toolbar, Tour, type TourStepDef, type UseTourProps } from "@rind-ui/react"
import { type ReactNode, useId, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = {
  tour: { idle: "Basic", preparing: "Preparing", active: "Open", waiting: "Waiting" },
}

const nav = [
  { action: "prev" as const, label: "Back" },
  { action: "next" as const, label: "Next" },
]
// the last step ends the tour instead of offering a next one
const last = [
  { action: "prev" as const, label: "Back" },
  { action: "dismiss" as const, label: "Done" },
]

/** The card every example uses: title, description, progress, actions, close. */
function Card({ children }: { readonly children?: ReactNode }) {
  return (
    <Tour.Portal>
      <Tour.Backdrop />
      <Tour.Spotlight />
      <Tour.Positioner>
        <Tour.Content>
          <Tour.Arrow />
          <Tour.Title />
          <Tour.Description />
          {children}
          <div className="row">
            <Tour.ProgressText />
            <Tour.Actions>
              {(actions) =>
                actions.map((a) => (
                  <Tour.ActionTrigger key={String(a.label ?? a.action)} action={a} />
                ))
              }
            </Tour.Actions>
          </div>
          <Tour.CloseTrigger>Close</Tour.CloseTrigger>
        </Tour.Content>
      </Tour.Positioner>
    </Tour.Portal>
  )
}

/** A small app with a search field and a toolbar to point at, ids scoped per example. */
function Stage({
  steps,
  children,
  trigger = "Take the tour",
  ...props
}: Omit<Partial<UseTourProps>, "steps"> & {
  readonly steps: (ids: { search: string; toolbar: string }) => TourStepDef[]
  readonly children?: ReactNode
  readonly trigger?: string
}) {
  const base = useId()
  const ids = { search: `${base}-search`, toolbar: `${base}-toolbar` }
  return (
    <div className="stack">
      {/* rind parts, so the field and the toolbar wear the skin; on one text baseline, since the
          field's box is taller than its input (the label sits in it) */}
      <div className="row" style={{ alignItems: "last baseline" }}>
        {/* the tour's targets are plain wrappers: an id on a rind part would replace the one it
            generates (an input's is what its Label is tied to) */}
        <div id={ids.search}>
          <TextField.Root className="row">
            <TextField.Label>Search</TextField.Label>
            <TextField.Input />
          </TextField.Root>
        </div>
        <div id={ids.toolbar}>
          <Toolbar.Root className="row" aria-label="Formatting">
            <Toolbar.Button>Bold</Toolbar.Button>
            <Toolbar.Button>Italic</Toolbar.Button>
          </Toolbar.Root>
        </div>
      </div>
      {children}
      <Tour.Root steps={steps(ids)} {...props}>
        <Tour.Trigger>{trigger}</Tour.Trigger>
        <Card />
      </Tour.Root>
    </div>
  )
}

const byId = (id: string) => () => document.getElementById(id)

const basicSteps = (ids: { search: string; toolbar: string }): TourStepDef[] => [
  {
    id: "welcome",
    title: "Welcome",
    description: "Three quick steps through the editor.",
    actions: [{ action: "skip", label: "Skip" }, ...nav],
  },
  {
    id: "search",
    title: "Search",
    description: "Find any file by name.",
    target: byId(ids.search),
    actions: nav,
  },
  {
    id: "toolbar",
    title: "Formatting",
    description: "Bold and italic live here.",
    target: byId(ids.toolbar),
    side: "top",
    actions: last,
  },
]

export function Basic() {
  return <Stage steps={basicSteps} />
}

export function Open() {
  return <Stage steps={basicSteps} defaultOpen defaultStepId="search" />
}

export function AsyncEffect() {
  const [panel, setPanel] = useState(false)
  return (
    <Stage
      trigger="Show the panel"
      steps={() => [
        {
          id: "panel",
          title: "Your panel",
          description: "Opened by the step's effect before the card appeared.",
          target: () => document.getElementById("tour-panel"),
          effect: ({ waitForElement }) => {
            setPanel(true)
            // The step shows once the panel is rendered; the cleanup closes it again.
            return waitForElement(() => document.getElementById("tour-panel")).then(
              () => () => setPanel(false),
            )
          },
          actions: [{ action: "dismiss", label: "Got it" }],
        },
      ]}
    >
      {panel ? (
        <aside id="tour-panel" className="note">
          The panel
        </aside>
      ) : null}
    </Stage>
  )
}

const waitSteps = (ids: { search: string; toolbar: string }): TourStepDef[] => [
  {
    id: "type",
    title: "Type a search",
    description: "Type a word, then press Enter.",
    target: byId(ids.search),
    actions: nav,
  },
  {
    id: "wait-enter",
    type: "wait",
    target: byId(ids.search),
    effect: async ({ waitForEvent, target, next }) => {
      await waitForEvent<KeyboardEvent>(target, "keydown", { predicate: (e) => e.key === "Enter" })
      next()
    },
  },
  { id: "done", title: "Found it", description: "That is all there is to search.", actions: last },
]

export function WaitStep() {
  return <Stage steps={waitSteps} />
}

export function Waiting() {
  return <Stage steps={waitSteps} defaultOpen defaultStepId="wait-enter" />
}

export function Preparing() {
  return (
    <Stage
      steps={() => [
        {
          id: "later",
          title: "Not here yet",
          target: () => document.getElementById("tour-never"),
          timeout: 60_000,
          actions: nav,
        },
      ]}
      defaultOpen
    />
  )
}

export function MissingTarget() {
  return (
    <Stage
      steps={(ids) => [
        {
          id: "gone",
          title: "Settings",
          description: "Its button is not on this page: the step is shown centred.",
          target: () => document.getElementById("tour-missing"),
          missingTarget: "center",
          timeout: 300,
          actions: nav,
        },
        { id: "search", title: "Search", target: byId(ids.search), actions: nav },
      ]}
    />
  )
}

export function Shielded() {
  return (
    <Stage
      preventTargetInteraction
      steps={(ids) => [
        {
          id: "toolbar",
          title: "Look, don't touch",
          description:
            "Presses on the highlighted toolbar are swallowed; the keyboard still works.",
          target: byId(ids.toolbar),
          actions: [{ action: "dismiss", label: "Got it" }],
        },
      ]}
    />
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [reason, setReason] = useState("—")
  return (
    <Stage
      steps={basicSteps}
      open={open}
      stepId={step}
      onOpenChange={(next, d) => {
        setOpen(next)
        if (!next) setReason(d.reason)
      }}
      onStepChange={(id) => setStep(id)}
    >
      <p className="note">
        Step: {step ?? "none"} · last close reason: {reason}
      </p>
    </Stage>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "A centred welcome, then steps that point at the page.",
  },
  Open: { title: "Open", description: "`defaultOpen` at an anchored step.", hidden: true },
  AsyncEffect: {
    title: "Async step effect",
    description: "The effect opens a panel, waits for it, and closes it when the step ends.",
  },
  WaitStep: {
    title: "Wait step",
    description: "A step with no card: its effect waits for Enter, then moves on.",
  },
  Waiting: { title: "Waiting", description: "A wait step in progress.", hidden: true },
  Preparing: { title: "Preparing", description: "A target that is not there yet.", hidden: true },
  MissingTarget: {
    title: "Missing target",
    description: '`missingTarget: "center"` shows the step centred after its timeout.',
  },
  Shielded: {
    title: "Target interaction shield",
    description: "`preventTargetInteraction`: pointer presses on the target do nothing.",
  },
  Controlled: {
    title: "Controlled",
    description: "`open` and `stepId` from the parent; the close reason reported.",
  },
}
