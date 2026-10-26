// Citation (React): a link marker for an http(s) source, a button marker that pins its card, a
// pending marker as plain text upgraded in place, Escape unpins, the source parts, server HTML.
import type { CitationSource } from "@rind-ui/core"
import { Citation, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCitation, virtualClock } from "../index"

afterEach(() => vi.restoreAllMocks())

const settle = () => act(async () => {})

const LINK: CitationSource = {
  title: "Example Domain",
  url: "https://www.example.com/page",
  snippet: "This domain is for use in examples.",
}
const NOTE: CitationSource = { title: "Internal note", snippet: "No public URL." }

function setup(source: CitationSource | undefined, onPinnedChange = vi.fn(), openDelay = 300) {
  const clock = virtualClock()
  // A zero open delay runs on real timers: the driver's wait cannot advance a virtual clock.
  const ui = (s: CitationSource | undefined) => (
    <RindProvider environment={openDelay === 0 ? {} : { scheduler: clock.scheduler }}>
      <p>
        <Citation.Root
          index={1}
          {...(s ? { source: s } : {})}
          onPinnedChange={onPinnedChange}
          openDelay={openDelay}
        >
          <Citation.CitedText>Examples are reserved</Citation.CitedText>
          <Citation.Trigger>[1]</Citation.Trigger>
          <Citation.Positioner>
            <Citation.Content>
              <Citation.Source>
                <Citation.SourceTitle />
                <Citation.SourceUrl />
                <Citation.SourceSnippet />
              </Citation.Source>
            </Citation.Content>
          </Citation.Positioner>
        </Citation.Root>
      </p>
    </RindProvider>
  )
  const r = render(ui(source))
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    clock,
    onPinnedChange,
    q,
    rerender: async (s: CitationSource | undefined) => {
      r.rerender(ui(s))
      await settle()
    },
    d: () => getCitation(document.body),
  }
}

describe("React Citation", () => {
  it("a link marker follows its http(s) source, named with its index and title", async () => {
    const t = setup(LINK)
    await settle()
    const marker = t.q('[data-part="trigger"]') as HTMLElement
    expect(marker.tagName).toBe("A")
    expect(marker.getAttribute("href")).toBe("https://www.example.com/page")
    expect(marker.getAttribute("aria-label")).toBe("Source 1: Example Domain")
    expect(marker.textContent).toBe("[1]")
    expect(await t.d().kind()).toBe("link")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a button marker pins its card on press; Escape unpins", async () => {
    const t = setup(NOTE)
    await settle()
    const marker = t.q('[data-part="trigger"]') as HTMLElement
    expect(marker.tagName).toBe("BUTTON")
    expect(marker.getAttribute("aria-expanded")).toBe("false")
    await t.d().via("pointer").pin()
    await settle()
    expect(await t.d().isPinned()).toBe(true)
    expect(await t.d().isOpen()).toBe(true)
    expect(t.onPinnedChange).toHaveBeenCalledWith(true)
    expect(await t.d().sourceTitle()).toBe("Internal note")
    expect(t.q('[data-part="source-snippet"]')?.textContent).toBe("No public URL.")
    await t.d().via("keyboard").hide()
    await settle()
    expect(await t.d().isPinned()).toBe(false)
    expect(t.onPinnedChange).toHaveBeenLastCalledWith(false)
  })

  it("is plain text while the source is pending, and becomes the marker in place", async () => {
    const t = setup(undefined)
    await settle()
    const pending = t.q('[data-part="trigger"]') as HTMLElement
    expect(pending.tagName).toBe("SPAN")
    expect(pending.dataset["state"]).toBe("pending")
    expect(pending.hasAttribute("tabindex")).toBe(false)
    await t.rerender(LINK)
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("A")
  })

  it("shows the domain of the source when open", async () => {
    const t = setup(LINK, vi.fn(), 0)
    await settle()
    await t.d().via("keyboard").show()
    await settle()
    expect(t.q('[data-part="source-url"]')?.textContent).toBe("example.com")
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <p>
            <Citation.Root index={2} source={LINK}>
              <Citation.Trigger>[2]</Citation.Trigger>
            </Citation.Root>
          </p>
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector("a")?.getAttribute("aria-label")).toBe(
      "Source 2: Example Domain",
    )
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
