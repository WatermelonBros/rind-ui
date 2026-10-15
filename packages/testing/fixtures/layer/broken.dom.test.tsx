// Overlay lifecycle through the layer fixture (Strict Mode, unmount while open, hydration,
// React bubbling through the portal), plus one deliberately broken layer per invariant
// (add-overlay-infrastructure 8.4, 9.5): each must fail testMachine with a report naming it.
import { type AnyContract, getLayerStack } from "@rind-ui/core"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { type ReactElement, StrictMode, useEffect, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, testMachine } from "../../src/index"
import { layerContract } from "./layer.contract"
import { LayerExample } from "./layer.fixture"
import { Layer } from "./layer.react"

const hosts = () => document.querySelectorAll("[data-rind-portal]")
const locked = () => document.documentElement.hasAttribute("data-rind-scroll-locked")
// An emptied style attribute equals none (browsers keep it after removeProperty).
const attrsOf = (el: Element) =>
  [...el.attributes]
    .filter((a) => !(a.name === "style" && a.value === ""))
    .map((a) => `${a.name}=${a.value}`)
    .sort()

/** Nothing the layer added is left on the page. */
function expectClean(before: { html: string[]; body: string[] }) {
  expect(hosts()).toHaveLength(0)
  expect(getLayerStack(document).layers()).toHaveLength(0)
  expect(document.querySelectorAll("[inert]")).toHaveLength(0)
  expect(locked()).toBe(false)
  expect(document.body.hasAttribute("data-rind-scroll-locked")).toBe(false)
  expect(attrsOf(document.documentElement)).toEqual(before.html)
  expect(attrsOf(document.body)).toEqual(before.body)
}
const snapshot = () => ({ html: attrsOf(document.documentElement), body: attrsOf(document.body) })

afterEach(() => {
  vi.restoreAllMocks()
})

describe("layer lifecycle", () => {
  it("Strict Mode double mount: one host, one layer, locked; unmount restores the page", async () => {
    const before = snapshot()
    const { unmount } = render(
      <StrictMode>
        <div id="app">
          <LayerExample defaultOpen label="Open" />
        </div>
      </StrictMode>,
    )
    await waitFor(() => expect(hosts()).toHaveLength(1))
    expect(getLayerStack(document).layers()).toHaveLength(1)
    expect(locked()).toBe(true)
    unmount()
    expectClean(before)
  })

  it("unmounting while open leaves the page clean", async () => {
    const before = snapshot()
    const { unmount } = render(
      <div id="app">
        <LayerExample defaultOpen label="Open" />
      </div>,
    )
    await waitFor(() => expect(hosts()).toHaveLength(1))
    await waitFor(() => expect(document.getElementById("app")?.closest("[inert]")).not.toBeNull())
    unmount()
    expectClean(before)
  })

  it("server render has no portal; hydration logs no mismatch and mounts the content", async () => {
    const ui = <LayerExample defaultOpen label="Open" />
    const container = document.createElement("div")
    container.innerHTML = renderToString(ui)
    document.body.append(container)
    expect(container.innerHTML).not.toContain("data-rind-portal")
    expect(container.innerHTML).not.toContain('role="dialog"')
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, ui)
    })
    expect(error).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy())
    act(() => root?.unmount())
    container.remove()
  })

  it("React stopPropagation on an ancestor does not change dismissal (base-ui#2312)", async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a test ancestor that swallows React events
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <LayerExample defaultOpen label="Open" onOpenChange={onOpenChange} />
      </div>,
    )
    const dialog = await screen.findByRole("dialog")
    const press = (el: Element, pointerType = "mouse") => {
      fireEvent.pointerDown(el, { pointerType, button: 0, isPrimary: true })
      fireEvent.pointerUp(el, { pointerType, button: 0, isPrimary: true })
      fireEvent.click(el)
    }
    // Inside the portalled content: a React ancestor sees the synthetic event, the layer ignores it.
    press(screen.getByLabelText("Name"))
    expect(dialog.isConnected).toBe(true)
    expect(onOpenChange).not.toHaveBeenCalled()
    // Outside: dismissal listens on the document, not on React's tree.
    press(container)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything()))
  })
})

/** Runs testMachine with a collecting registrar; returns each test's name and failure. */
async function failuresOf<C extends AnyContract>(
  c: C,
  ui: () => ReactElement,
  options: { anchor: string; props?: Record<string, unknown> },
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(c, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(ui()),
    target: () => domEnv({ timeout: 200 }),
    anchor: [options.anchor] as never,
    ...(options.props ? { props: options.props as never } : {}),
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    cleanup()
    document.body.removeAttribute("style")
    document.body.removeAttribute("data-rind-scroll-locked")
    document.documentElement.removeAttribute("data-rind-scroll-locked")
    out.push({ name: t.name, error })
  }
  return out
}
const errors = (results: { error: string | null }[]) =>
  results.map((r) => r.error).filter((e): e is string => e !== null)
const options = { anchor: "Settings", props: { open: undefined, root: "oracle" } }

describe("broken layers fail with the invariant's name", () => {
  it("outside never inert → modal", { timeout: 60_000 }, async () => {
    function Meddling() {
      useEffect(() => {
        // A body child that holds no part of the instance (Testing Library's container does,
        // so the invariant would not judge it).
        const page = document.createElement("div")
        page.textContent = "page"
        document.body.append(page)
        // Broken: something un-inerts the page as soon as the layer marks it.
        const observer = new MutationObserver(() => page.removeAttribute("inert"))
        observer.observe(page, { attributes: true, attributeFilter: ["inert"] })
        return () => {
          observer.disconnect()
          page.remove()
        }
      }, [])
      return <LayerExample label="Settings" />
    }
    const results = await failuresOf(
      layerContract,
      () => (
        <div id="app">
          <Meddling />
        </div>
      ),
      options,
    )
    expect(
      errors(results).some((e) => e.includes("is outside the open modal layer but not inert")),
    ).toBe(true)
  })

  it("stuck body overflow → document-clean", { timeout: 60_000 }, async () => {
    const results = await failuresOf(
      layerContract,
      () => (
        <div id="app">
          {/* Broken: sets overflow on open and never removes it. */}
          <LayerExample
            label="Settings"
            onOpenChange={(open) => {
              if (open) document.body.style.overflow = "hidden"
            }}
          />
        </div>
      ),
      options,
    )
    expect(errors(results).some((e) => e.includes("<body> style overflow"))).toBe(true)
  })

  it("inert stuck on the page after unmounting while open → document-clean", {
    timeout: 60_000,
  }, async () => {
    function Sticky() {
      useEffect(() => {
        document.getElementById("stuck-page")?.remove()
        const page = document.createElement("div")
        page.id = "stuck-page"
        page.textContent = "page"
        document.body.append(page)
        // Broken: the unmount leaves the page inert (and the page stays); after the layer's
        // own cleanup, which runs after this parent's.
        return () => queueMicrotask(() => page.setAttribute("inert", ""))
      }, [])
      return <LayerExample label="Settings" />
    }
    const results = await failuresOf(
      layerContract,
      () => (
        <div id="app">
          <Sticky />
        </div>
      ),
      options,
    )
    document.getElementById("stuck-page")?.remove()
    expect(
      errors(results).some(
        (e) => e.includes("unmounted while open") && e.includes("div#stuck-page inert"),
      ),
    ).toBe(true)
  })

  it("scroll lock removed while open → modal", { timeout: 60_000 }, async () => {
    function Unlocker() {
      useEffect(() => {
        const html = document.documentElement
        // Broken: something drops the lock as soon as it is set.
        const observer = new MutationObserver(() => {
          if (html.hasAttribute("data-rind-scroll-locked")) {
            html.removeAttribute("data-rind-scroll-locked")
          }
        })
        observer.observe(html, { attributes: true, attributeFilter: ["data-rind-scroll-locked"] })
        return () => observer.disconnect()
      }, [])
      return <LayerExample label="Settings" />
    }
    const results = await failuresOf(
      layerContract,
      () => (
        <div id="app">
          <Unlocker />
        </div>
      ),
      options,
    )
    expect(
      errors(results).some((e) =>
        e.includes("the page is not scroll-locked while the modal layer is open"),
      ),
    ).toBe(true)
  })

  it("focus left on body → modal", { timeout: 60_000 }, async () => {
    const results = await failuresOf(
      layerContract,
      () => (
        <div id="app">
          <Layer.Root>
            <Layer.Trigger>Settings</Layer.Trigger>
            <Layer.Portal>
              <Layer.Positioner>
                {/* Broken: whatever takes focus inside hands it straight back to <body>. */}
                <Layer.Content
                  data-focus-within=""
                  onFocus={(e) => (e.target as HTMLElement).blur()}
                >
                  <Layer.Title>Settings</Layer.Title>
                  <Layer.Close>Close</Layer.Close>
                </Layer.Content>
              </Layer.Positioner>
            </Layer.Portal>
          </Layer.Root>
        </div>
      ),
      options,
    )
    expect(errors(results).some((e) => e.includes("focus is on <body>"))).toBe(true)
  })

  it("content that outlives its exit → presence", { timeout: 60_000 }, async () => {
    function Ghost() {
      const [open, setOpen] = useState(false)
      return (
        <div id="app">
          <LayerExample id="g1" label="Settings" onOpenChange={setOpen} />
          {/* Broken: a content part that ignores presence and stays after closing. */}
          {!open ? (
            <div data-scope="layer" data-part="content" data-instance="g1" data-state="closed" />
          ) : null}
        </div>
      )
    }
    const results = await failuresOf(layerContract, () => <Ghost />, options)
    expect(
      errors(results).some((e) => e.includes("still mounted after its exit animations finished")),
    ).toBe(true)
  })
})

// jsdom runs no animations: the exit is only observable in a real browser.
const animates =
  typeof Element.prototype.getAnimations === "function" && !navigator.userAgent.includes("jsdom")

describe.runIf(animates)("reopening during the exit animation", () => {
  const exitStyle =
    "@keyframes rind-test-exit{from{opacity:1}to{opacity:0}}" +
    '[data-part="content"][data-state="closed"]{animation:rind-test-exit 400ms}'
  function Styled({ children }: { children: ReactElement }) {
    return (
      <div id="app">
        <style>{exitStyle}</style>
        {children}
      </div>
    )
  }

  it("keeps the exiting element: passes", { timeout: 60_000 }, async () => {
    const results = await failuresOf(
      layerContract,
      () => (
        <Styled>
          <LayerExample label="Settings" />
        </Styled>
      ),
      options,
    )
    expect(errors(results).filter((e) => e.includes("presence"))).toEqual([])
  })

  it("a content remounted on reopen → presence", { timeout: 60_000 }, async () => {
    function Remounting() {
      const [opens, setOpens] = useState(0)
      return (
        <Layer.Root onOpenChange={(open) => open && setOpens((n) => n + 1)}>
          <Layer.Trigger>Settings</Layer.Trigger>
          <Layer.Portal>
            <Layer.Positioner>
              {/* Broken: a new element on every open, even while the old one is exiting. */}
              <Layer.Content key={opens}>
                <Layer.Title>Settings</Layer.Title>
                <input aria-label="Name" />
                <Layer.Close>Close</Layer.Close>
              </Layer.Content>
            </Layer.Positioner>
          </Layer.Portal>
        </Layer.Root>
      )
    }
    const results = await failuresOf(
      layerContract,
      () => (
        <Styled>
          <Remounting />
        </Styled>
      ),
      options,
    )
    expect(errors(results).some((e) => e.includes("reopening during the exit"))).toBe(true)
  })
})
