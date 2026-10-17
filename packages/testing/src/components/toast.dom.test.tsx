// Toast scenarios (openspec add-toast) through the toast drivers, in jsdom and browsers.
import { createToaster, type Toaster as ToasterStore } from "@rind-ui/core"
import { Dialog, Toast, Toaster } from "@rind-ui/react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, getToast, getToaster, installAnnouncementLog } from "../index"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function App({ store }: { store: ToasterStore }) {
  return (
    <>
      <input aria-label="Name" />
      <Toaster toaster={store}>
        {(t) => (
          <Toast.Root>
            <Toast.Title />
            {t.data.description ? <Toast.Description /> : null}
            {t.data.action ? <Toast.ActionTrigger /> : null}
            <Toast.CloseTrigger>
              <svg aria-hidden="true" width="12" height="12" />
            </Toast.CloseTrigger>
          </Toast.Root>
        )}
      </Toaster>
    </>
  )
}

describe("Toast: region and semantics", () => {
  it("no region while empty (zag#2988); a named region with a list once a toast shows", async () => {
    const store = createToaster()
    render(<App store={store} />)
    expect(screen.queryByRole("region")).toBe(null)
    act(() => void store.show({ title: "Saved", description: "3 files" }))
    const region = await screen.findByRole("region", { name: "Notifications (F6)" })
    expect(region.querySelector("ol")).toBeTruthy()
    expect(region.querySelector("[aria-live]")).toBe(null)
    const item = screen.getByRole("listitem", { name: "Saved" })
    expect(item.getAttribute("role")).toBe(null)
    expect(item.getAttribute("tabindex")).toBe("0")
  })

  it("one polite announcement: 'Saved. 3 files' (reka-ui#2611)", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    const store = createToaster()
    render(<App store={store} />)
    act(() => void store.show({ title: "Saved", description: "3 files" }))
    await screen.findByRole("listitem", { name: "Saved" })
    await vi.waitFor(() =>
      expect(log.slice(start).map((a) => a.message)).toEqual(["Saved. 3 files"]),
    )
  })

  it("the close trigger dismisses with reason close-trigger; an icon-only one is named", async () => {
    const store = createToaster()
    const onDismiss = vi.fn()
    render(<App store={store} />)
    act(() => void store.show({ title: "Saved", onDismiss }))
    await screen.findByRole("listitem", { name: "Saved" })
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeTruthy()
    await getToast(screen, { name: "Saved" }).via("pointer").dismiss()
    expect(onDismiss).toHaveBeenCalledWith("close-trigger")
  })

  it("Escape closes only the focused toast (radix#2906)", async () => {
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    act(() => {
      store.show("First")
      store.show("Second")
      store.show("Third")
    })
    await screen.findByRole("listitem", { name: "First" })
    await getToast(screen, { name: "First" }).via("keyboard").dismiss()
    await vi.waitFor(() => expect(screen.queryByRole("listitem", { name: "First" })).toBe(null))
    expect(screen.getByRole("listitem", { name: "Second" })).toBeTruthy()
    expect(screen.getByRole("listitem", { name: "Third" })).toBeTruthy()
  })

  it("F6 jumps to the newest toast and back (Jump in and back)", async () => {
    const user = userEvent.setup()
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    act(() => {
      store.show("Older")
      store.show("Newer")
    })
    await screen.findByRole("listitem", { name: "Newer" })
    const name = screen.getByRole("textbox", { name: "Name" })
    name.focus()
    await user.keyboard("{F6}")
    expect(document.activeElement).toBe(screen.getByRole("listitem", { name: "Newer" }))
    await user.keyboard("{F6}")
    expect(document.activeElement).toBe(name)
  })

  it("the action runs and dismisses with reason action; closes:false keeps it (reka-ui#2626)", async () => {
    const store = createToaster()
    const onAction = vi.fn()
    render(<App store={store} />)
    act(
      () =>
        void store.show({ title: "Archived", action: { label: "Undo", onAction, closes: false } }),
    )
    await screen.findByRole("listitem", { name: "Archived" })
    await userEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("listitem", { name: "Archived" })).toBeTruthy()
  })

  it("above a modal dialog: the region is not inert and Undo works; the dialog stays open (radix#4115)", async () => {
    const store = createToaster()
    const onAction = vi.fn()
    render(
      <>
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Content>
              <Dialog.Title>Settings</Dialog.Title>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <App store={store} />
      </>,
    )
    act(() => void store.show({ title: "Archived", action: { label: "Undo", onAction } }))
    const item = await screen.findByRole("listitem", { name: "Archived" })
    expect(item.closest("[inert]")).toBe(null)
    await userEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
  })

  it("the toaster driver: titles newest first, enter by hotkey", async () => {
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    act(() => {
      store.show("One")
      store.show("Two")
    })
    await screen.findByRole("listitem", { name: "Two" })
    const t = getToaster(screen, { name: "Notifications (F6)" }).via("keyboard")
    expect(await t.titles()).toEqual(["Two", "One"])
    await t.enter()
    expect(await t.hasFocus()).toBe(true)
  })

  it("lifetime: dismissed after its duration with fake time", async () => {
    vi.useFakeTimers()
    // Testing Library drains its async wrapper with a timer only `jest` fake timers advance.
    vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
    const store = createToaster({ duration: 3000 })
    render(<App store={store} />)
    act(() => void store.show("Brief"))
    const env = domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    const toast = getToast(env, { name: "Brief" }).via("keyboard")
    // fake-time: the toast's own lifetime
    await toast.waitForTimeout()
    expect(await toast.isShown()).toBe(false)
  })
})

const inJsdom = navigator.userAgent.includes("jsdom")

describe("Toast: focus, limit, stores, swipe", () => {
  it("a focused toast removed: focus to the newer one (Focused toast removed)", async () => {
    const user = userEvent.setup()
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    let middle = ""
    act(() => {
      store.show("Oldest")
      middle = store.show("Middle")
      store.show("Newest")
    })
    await screen.findByRole("listitem", { name: "Middle" })
    screen.getByRole("textbox", { name: "Name" }).focus()
    await user.keyboard("{F6}")
    screen.getByRole("listitem", { name: "Middle" }).focus()
    act(() => store.dismiss(middle as never))
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("listitem", { name: "Newest" })),
    )
  })

  it("Tab from a toast reaches its first button (zag#2258)", async () => {
    const user = userEvent.setup()
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    act(() => void store.show({ title: "Archived", action: { label: "Undo", onAction: () => {} } }))
    const item = await screen.findByRole("listitem", { name: "Archived" })
    item.focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }))
  })

  it("beyond the limit: held, inert, and presented again (zag#2403)", async () => {
    const store = createToaster({ limit: 2, duration: Number.POSITIVE_INFINITY })
    render(<App store={store} />)
    let newest = ""
    act(() => {
      store.show("A")
      store.show("B")
      newest = store.show("C")
    })
    const a = await screen.findByRole("listitem", { name: "A", hidden: true })
    expect(a.hasAttribute("data-limited")).toBe(true)
    expect(a.hasAttribute("inert")).toBe(true)
    act(() => store.dismiss(newest as never))
    await vi.waitFor(() => expect(a.hasAttribute("data-limited")).toBe(false))
  })

  it("two stores: each toast only in its own region", async () => {
    const notes = createToaster()
    const status = createToaster({ placement: "top-center" })
    render(
      <>
        <App store={notes} />
        <Toaster toaster={status} messages={{ regionLabel: (k) => `Status (${k})` }}>
          {() => (
            <Toast.Root>
              <Toast.Title />
            </Toast.Root>
          )}
        </Toaster>
      </>,
    )
    act(() => void status.info("Offline"))
    const region = await screen.findByRole("region", { name: "Status (F6)" })
    expect(region.textContent).toContain("Offline")
    expect(screen.queryByRole("region", { name: "Notifications (F6)" })).toBe(null)
  })

  it("Strict Mode: one toast per show (sonner#592)", async () => {
    const { StrictMode } = await import("react")
    const store = createToaster()
    render(
      <StrictMode>
        <App store={store} />
      </StrictMode>,
    )
    act(() => void store.show("Once"))
    await screen.findByRole("listitem", { name: "Once" })
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })

  it("a toast shown before the Toaster mounts appears when it mounts (zag#2922)", async () => {
    const store = createToaster()
    store.error("Could not save")
    render(<App store={store} />)
    expect(await screen.findByRole("listitem", { name: "Could not save" })).toBeTruthy()
  })

  it.skipIf(inJsdom)("swipe right past the threshold dismisses with reason swipe", async () => {
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    const onDismiss = vi.fn()
    render(<App store={store} />)
    act(() => void store.show({ title: "Swipe me", onDismiss }))
    await screen.findByRole("listitem", { name: "Swipe me" })
    await getToast(screen, { name: "Swipe me" }).via("touch").swipe("right")
    await vi.waitFor(() => expect(onDismiss).toHaveBeenCalledWith("swipe"))
  })

  it.skipIf(inJsdom)("a flick in an excluded direction keeps it (sonner#762)", async () => {
    const store = createToaster({
      duration: Number.POSITIVE_INFINITY,
      swipeDirections: ["up", "right"],
    })
    render(<App store={store} />)
    act(() => void store.show("Stay"))
    await screen.findByRole("listitem", { name: "Stay" })
    await getToast(screen, { name: "Stay" }).via("touch").swipe("left")
    expect(await getToast(screen, { name: "Stay" }).isShown()).toBe(true)
  })
})

describe("Toast: server rendering", () => {
  it("the server renders no region; it appears after hydration", async () => {
    const { renderToString } = await import("react-dom/server")
    const store = createToaster()
    store.show("Welcome back")
    const html = renderToString(<App store={store} />)
    expect(html).not.toContain("Welcome back")
    expect(html).not.toContain('role="region"')
    render(<App store={store} />)
    expect(await screen.findByRole("listitem", { name: "Welcome back" })).toBeTruthy()
  })
})
