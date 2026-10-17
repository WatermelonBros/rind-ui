// Tour scenarios (openspec add-tour): the spec's scenarios through the parts, in jsdom and in
// real browsers, through the tour driver where possible. Layout-only scenarios (cutout
// geometry on screen, the pointer shield) are in tour.browser.test.tsx.
import {
  Dialog,
  RindProvider,
  Tour,
  type TourHandle,
  type TourStepDef,
  type UseTourProps,
  useTour,
} from "@rind-ui/react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, StrictMode, useEffect, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTour, installAnnouncementLog } from "../index"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const content = () =>
  document.querySelector<HTMLElement>('[data-scope="tour"][data-part="content"]')
const step = () => content()?.getAttribute("data-step") ?? null
const shownStep = async (id: string) => vi.waitFor(() => expect(step()).toBe(id))

/** The card most examples use: title, description, progress, actions, close. */
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
          <Tour.ProgressText />
          {children}
          <Tour.Actions>
            {(actions) =>
              actions.map((a) => (
                <Tour.ActionTrigger
                  key={String(typeof a.action === "string" ? a.action : a.label)}
                  action={a}
                />
              ))
            }
          </Tour.Actions>
          <Tour.CloseTrigger />
        </Tour.Content>
      </Tour.Positioner>
    </Tour.Portal>
  )
}

const nav = [{ action: "prev" as const }, { action: "next" as const }]

const page = (
  <>
    <button type="button" id="search">
      Search
    </button>
    <div id="toolbar" style={{ width: 200, height: 40 }}>
      <button type="button">Bold</button>
    </div>
    <label>
      Name <input id="name" />
    </label>
    <button type="button" id="after">
      After
    </button>
  </>
)

const byId = (id: string) => () => document.getElementById(id)

const threeSteps: TourStepDef[] = [
  { id: "welcome", title: "Welcome", description: "A short tour.", actions: nav },
  { id: "search", title: "Search", target: byId("search"), actions: nav },
  { id: "toolbar", title: "Toolbar", target: byId("toolbar"), actions: nav },
]

function App(props: Partial<UseTourProps> & { readonly children?: ReactNode }) {
  const { children, ...rest } = props
  return (
    <div id="app">
      {page}
      <Tour.Root steps={threeSteps} {...rest}>
        <Tour.Trigger>Take the tour</Tour.Trigger>
        <Card>{children}</Card>
      </Tour.Root>
    </div>
  )
}

describe("driver round trip", () => {
  it("start, next, pressEscape (escape-key reported)", async () => {
    const onOpenChange = vi.fn()
    render(<App onOpenChange={onOpenChange} />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    expect(await t.stepId()).toBe("welcome")
    expect(await t.title()).toBe("Welcome")
    await t.next()
    await shownStep("search")
    await t.pressEscape()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({
        reason: "escape-key",
        stepId: "search",
        stepIndex: 1,
        complete: false,
      }),
    )
  })
})

describe("anatomy", () => {
  it("buttons never submit a form (zag#3268)", async () => {
    const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <App />
      </form>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Take the tour" }))
    await vi.waitFor(() => expect(content()).not.toBeNull())
    await user.click(screen.getByRole("button", { name: "Next" }))
    await shownStep("search")
    await user.click(screen.getByRole("button", { name: "Close tour" }))
    expect(onSubmit).not.toHaveBeenCalled()
    for (const b of document.querySelectorAll(
      '[data-scope="tour"] button, button[data-scope="tour"]',
    )) {
      expect(b.getAttribute("type")).toBe("button")
    }
  })

  it("hook and Root: tour.start() from an effect outside the Root opens the first step", async () => {
    function Hooked() {
      const tour = useTour({ steps: threeSteps })
      useEffect(() => tour.start(), [tour.start])
      return (
        <>
          {page}
          <Tour.Root tour={tour}>
            <Card />
          </Tour.Root>
        </>
      )
    }
    render(<Hooked />)
    await shownStep("welcome")
  })

  it("two tours coexist: the idle one reads none of the open one's state", async () => {
    render(
      <>
        <App />
        <Tour.Root steps={[{ id: "other", title: "Other" }]}>
          <Tour.Trigger>Other tour</Tour.Trigger>
          <Card />
        </Tour.Root>
      </>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    expect(screen.getByRole("button", { name: "Other tour" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
    expect(document.querySelectorAll('[data-part="content"]')).toHaveLength(1)
  })
})

describe("name, progress and actions", () => {
  it("start focuses the content, named by the title; untitled steps read 'Step 2 of 3'", async () => {
    render(
      <div>
        {page}
        <Tour.Root
          steps={[
            { id: "a", title: "First", actions: nav },
            { id: "b", actions: nav },
            { id: "c", actions: nav },
          ]}
        >
          <Tour.Trigger>Take the tour</Tour.Trigger>
          <Tour.Portal>
            <Tour.Positioner>
              <Tour.Content>
                <Tour.Actions>
                  {(actions) =>
                    actions.map((a) => <Tour.ActionTrigger key={String(a.action)} action={a} />)
                  }
                </Tour.Actions>
              </Tour.Content>
            </Tour.Positioner>
          </Tour.Portal>
        </Tour.Root>
      </div>,
    )
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    expect(document.activeElement).toBe(content())
    expect(await t.title()).toBe("Step 1 of 3")
    await t.next()
    await shownStep("b")
    expect(await t.title()).toBe("Step 2 of 3")
  })

  it("progress ignores wait steps ('3 of 3') and exposes --rind-tour-progress", async () => {
    render(
      <App
        steps={[
          { id: "a", title: "A" },
          { id: "w", type: "wait" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
        ]}
        defaultStepId="c"
        defaultOpen
      />,
    )
    await shownStep("c")
    expect(document.querySelector('[data-part="progress-text"]')?.textContent).toBe("3 of 3")
    expect(content()?.style.getPropertyValue("--rind-tour-progress")).toBe("1")
    expect(content()?.hasAttribute("data-last")).toBe(true)
  })

  it("visible label wins; an empty close reads messages.close; partial overrides keep defaults", async () => {
    render(
      <RindProvider messages={{ tour: { close: "Chiudi" } }}>
        <App
          steps={[
            {
              id: "a",
              title: "A",
              actions: [{ action: "dismiss", label: "Got it" }, { action: "next" }],
            },
            { id: "b" },
          ]}
          messages={{ next: "Weiter" }}
        />
      </RindProvider>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Weiter" })).toBeTruthy()
    // The empty close trigger takes the provider's override.
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeTruthy()
  })

  it("an icon-only close is named by messages.close", async () => {
    render(
      <div>
        <Tour.Root steps={[{ id: "a", title: "A" }]} messages={{ close: "Chiudi" }}>
          <Tour.Trigger>Take the tour</Tour.Trigger>
          <Tour.Positioner>
            <Tour.Content>
              <Tour.Title />
              <Tour.CloseTrigger>
                <svg aria-hidden="true" />
              </Tour.CloseTrigger>
            </Tour.Content>
          </Tour.Positioner>
        </Tour.Root>
      </div>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Chiudi" })).toBeTruthy())
  })

  it("Back on the first step is aria-disabled, does nothing and keeps focus (intro.js#2073)", async () => {
    render(<App />)
    await getTour(screen, { name: "Take the tour" }).start()
    const back = screen.getByRole("button", { name: "Back" })
    expect(back.getAttribute("aria-disabled")).toBe("true")
    expect(back.hasAttribute("data-disabled")).toBe(true)
    back.focus()
    await userEvent.setup().click(back)
    expect(step()).toBe("welcome")
    expect(document.activeElement).toBe(back)
  })

  it("skip ends with reason skip (zag#3222); a custom action's goto shows that step", async () => {
    const onOpenChange = vi.fn()
    const steps: TourStepDef[] = [
      {
        id: "a",
        title: "A",
        actions: [
          { action: "skip", label: "Skip" },
          { action: ({ goto }) => goto("c"), label: "Settings" },
        ],
      },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ]
    render(<App steps={steps} onOpenChange={onOpenChange} />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    await userEvent.setup().click(screen.getByRole("button", { name: "Settings" }))
    await shownStep("c")
    await t.pressEscape()
    await t.start()
    await shownStep("a")
    await t.skip()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "skip" }),
    )
  })

  it("Next on the last step completes once with complete: true", async () => {
    const onOpenChange = vi.fn()
    render(<App onOpenChange={onOpenChange} defaultStepId="toolbar" />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy()
    await t.next()
    await vi.waitFor(() => expect(content()).toBeNull())
    const closes = onOpenChange.mock.calls.filter(([open]) => open === false)
    expect(closes).toHaveLength(1)
    expect(closes[0]?.[1]).toMatchObject({ reason: "complete", complete: true, stepId: "toolbar" })
  })
})

describe("targets and marks", () => {
  it("the mark moves with the step and is removed at the end", async () => {
    render(<App />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    await t.next()
    await shownStep("search")
    expect(document.getElementById("search")?.hasAttribute("data-rind-tour-target")).toBe(true)
    await t.next()
    await shownStep("toolbar")
    expect(document.getElementById("search")?.hasAttribute("data-rind-tour-target")).toBe(false)
    expect(document.getElementById("toolbar")?.hasAttribute("data-rind-tour-target")).toBe(true)
    await t.pressEscape()
    expect(document.querySelector("[data-rind-tour-target]")).toBeNull()
  })

  it("a late target is shown as soon as it appears", async () => {
    function Late() {
      const [show, setShow] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Reveal
          </button>
          {show ? (
            <button type="button" id="late">
              Late
            </button>
          ) : null}
          <Tour.Root
            steps={[
              { id: "a", title: "A" },
              { id: "late", title: "Late", target: byId("late") },
            ]}
            defaultStepId="late"
          >
            <Tour.Trigger>Take the tour</Tour.Trigger>
            <Card />
          </Tour.Root>
        </>
      )
    }
    render(<Late />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Take the tour" }))
    await vi.waitFor(() =>
      expect(document.querySelector('[data-part="backdrop"]')?.getAttribute("data-phase")).toBe(
        "preparing",
      ),
    )
    expect(content()).toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: "Reveal" }))
    await shownStep("late")
  })

  it("the target stays usable: typing in the highlighted field keeps the tour open (zag#2901)", async () => {
    render(<App steps={[{ id: "n", title: "Your name", target: byId("name") }]} />)
    await getTour(screen, { name: "Take the tour" }).start()
    const user = userEvent.setup()
    await user.click(document.getElementById("name") as HTMLElement)
    await user.keyboard("Ada")
    expect((document.getElementById("name") as HTMLInputElement).value).toBe("Ada")
    expect(step()).toBe("n")
    expect(document.getElementById("name")?.closest("[inert]")).toBeNull()
  })
})

describe("modality and focus", () => {
  it("a centred step is modal (app inert, aria-modal); an anchored one is not", async () => {
    render(<App />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    expect(content()?.getAttribute("aria-modal")).toBe("true")
    await vi.waitFor(() =>
      expect(document.getElementById("app")?.closest("[inert]")).not.toBeNull(),
    )
    await t.next()
    await shownStep("search")
    expect(content()?.hasAttribute("aria-modal")).toBe(false)
    await vi.waitFor(() => expect(document.getElementById("search")?.closest("[inert]")).toBeNull())
  })

  it("closing returns focus to the opener (shepherd#473), not between steps", async () => {
    render(<App />)
    const trigger = screen.getByRole("button", { name: "Take the tour" })
    const user = userEvent.setup()
    await user.click(trigger)
    await vi.waitFor(() => expect(document.activeElement).toBe(content()))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await shownStep("search")
    expect(document.activeElement).not.toBe(trigger)
    await user.click(screen.getByRole("button", { name: "Close tour" }))
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it("the user moved on: focus stays in the field they chose", async () => {
    render(<App defaultStepId="search" />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    const name = document.getElementById("name") as HTMLElement
    name.focus()
    await act(async () => {
      name.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    await vi.waitFor(() => expect(content()).toBeNull())
    expect(document.activeElement).toBe(name)
  })

  it("focus on Next survives the step change and the change is announced once", async () => {
    const log = installAnnouncementLog()
    render(<App />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Take the tour" }))
    await vi.waitFor(() => expect(document.activeElement).toBe(content()))
    const before = log.length
    const next = screen.getByRole("button", { name: "Next" })
    next.focus()
    await user.keyboard("{Enter}")
    await shownStep("search")
    await vi.waitFor(() => expect(log.length).toBe(before + 1))
    expect(log.at(-1)?.message).toBe("Step 2 of 3: Search")
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }))
  })
})

describe("keyboard", () => {
  it("ArrowRight / ArrowLeft move; not in a text field, not at the ends, not when off", async () => {
    render(
      <App>
        <input aria-label="Note" />
      </App>,
    )
    const user = userEvent.setup()
    await getTour(screen, { name: "Take the tour" }).start()
    await user.keyboard("{ArrowLeft}")
    expect(step()).toBe("welcome")
    await user.keyboard("{ArrowRight}")
    await shownStep("search")
    screen.getByRole("textbox", { name: "Note" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(step()).toBe("search")
    content()?.focus()
    await user.keyboard("{ArrowRight}")
    await shownStep("toolbar")
    // The last step: nothing, no error (intro.js#849).
    await user.keyboard("{ArrowRight}")
    expect(step()).toBe("toolbar")
  })

  it("right-to-left: ArrowLeft is Next (intro.js#2035); keyboardNavigation off ignores arrows", async () => {
    render(
      <div dir="rtl">
        <App />
      </div>,
    )
    const user = userEvent.setup()
    await getTour(screen, { name: "Take the tour" }).start()
    await user.keyboard("{ArrowLeft}")
    await shownStep("search")
    cleanup()
    render(<App keyboardNavigation={false} />)
    await getTour(screen, { name: "Take the tour" }).start()
    await user.keyboard("{ArrowRight}")
    expect(step()).toBe("welcome")
  })

  it("Escape closes only the topmost layer: a dialog opened from the target first", async () => {
    function WithDialog() {
      return (
        <>
          <Dialog.Root>
            <Dialog.Trigger id="open-dialog">Settings</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Content>
                <Dialog.Title>Settings</Dialog.Title>
                <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Tour.Root
            steps={[{ id: "s", title: "Settings live here", target: byId("open-dialog") }]}
          >
            <Tour.Trigger>Take the tour</Tour.Trigger>
            <Card />
          </Tour.Root>
        </>
      )
    }
    render(<WithDialog />)
    const user = userEvent.setup()
    await getTour(screen, { name: "Take the tour" }).start()
    await user.click(screen.getByRole("button", { name: "Settings" }))
    await vi.waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy())
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull())
    expect(step()).toBe("s")
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(content()).toBeNull())
  })
})

describe("effects and wait steps", () => {
  it("a wait step shows no card until the awaited click, then the next step", async () => {
    const steps: TourStepDef[] = [
      { id: "a", title: "A" },
      {
        id: "click-search",
        type: "wait",
        effect: async ({ waitForEvent, target, next }) => {
          await waitForEvent(document.getElementById("search"), "click")
          void target
          next()
        },
      },
      { id: "c", title: "C" },
    ]
    render(<App steps={steps} defaultStepId="click-search" />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Take the tour" }))
    await vi.waitFor(() =>
      expect(document.querySelector('[data-part="backdrop"]')?.getAttribute("data-phase")).toBe(
        "waiting",
      ),
    )
    expect(content()).toBeNull()
    await userEvent.setup().click(document.getElementById("search") as HTMLElement)
    await shownStep("c")
  })

  it("an async effect shows the card once, already updated", async () => {
    let release: () => void = () => {}
    const steps: TourStepDef[] = [
      { id: "a", title: "A", actions: nav },
      {
        id: "b",
        title: "B",
        description: "before",
        effect: async ({ update, show }) => {
          await new Promise<void>((r) => (release = r))
          update({ description: "after" })
          show()
        },
      },
    ]
    render(<App steps={steps} />)
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    await t.next()
    expect(content()).toBeNull()
    await act(async () => release())
    await shownStep("b")
    expect(await t.description()).toContain("after")
  })
})

describe("presence", () => {
  it("Strict Mode defaultOpen: one card, one onStepChange, no mark after unmount", async () => {
    const onStepChange = vi.fn()
    const { unmount } = render(
      <StrictMode>
        <App defaultOpen defaultStepId="search" onStepChange={onStepChange} />
      </StrictMode>,
    )
    await shownStep("search")
    expect(document.querySelectorAll('[data-part="content"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-part="backdrop"]')).toHaveLength(1)
    expect(onStepChange).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.querySelector("[data-rind-tour-target]")).toBeNull()
    expect(document.querySelector("[inert]")).toBeNull()
  })

  it("useTour exposes open, stepId and stepIndex", async () => {
    let handle: TourHandle | undefined
    function Probe() {
      const tour = useTour({ steps: threeSteps })
      handle = tour
      return (
        <>
          {page}
          <Tour.Root tour={tour}>
            <Card />
          </Tour.Root>
        </>
      )
    }
    render(<Probe />)
    expect(handle?.open).toBe(false)
    await act(async () => handle?.start({ stepId: "search" }))
    await shownStep("search")
    expect(handle?.stepId).toBe("search")
    expect(handle?.stepIndex).toBe(1)
  })
})

describe("backdrop", () => {
  const backdrop = () =>
    document.querySelector<HTMLElement>('[data-scope="tour"][data-part="backdrop"]')

  it("a step with backdrop: false dims nothing; the next step dims again (same node)", async () => {
    render(
      <App
        steps={[
          { id: "a", title: "A", target: byId("search"), backdrop: false, actions: nav },
          { id: "b", title: "B", target: byId("toolbar"), actions: nav },
        ]}
      />,
    )
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    const node = backdrop()
    expect(node?.hidden).toBe(true)
    await t.next()
    await shownStep("b")
    expect(backdrop()).toBe(node)
    expect(backdrop()?.hidden).toBe(false)
  })

  it("a run that starts on a wait step dims at once", async () => {
    render(
      <App
        steps={[
          { id: "w", type: "wait", effect: () => new Promise(() => {}) },
          { id: "b", title: "B" },
        ]}
      />,
    )
    await userEvent.setup().click(screen.getByRole("button", { name: "Take the tour" }))
    await vi.waitFor(() => expect(backdrop()?.getAttribute("data-phase")).toBe("waiting"))
    expect(backdrop()?.hidden).toBe(false)
    expect(backdrop()?.style.visibility).toBe("")
  })
})
