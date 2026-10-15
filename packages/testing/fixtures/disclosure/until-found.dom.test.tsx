import { act, render, screen } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Disclosure } from "./disclosure.react"

const supported = "onbeforematch" in document.createElement("div")
const frames = () =>
  act(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

function Example(props: { open?: boolean }) {
  return (
    <Disclosure.Root hiddenUntilFound {...props}>
      <Disclosure.Trigger>Details</Disclosure.Trigger>
      <Disclosure.Content>Hidden treasure</Disclosure.Content>
    </Disclosure.Root>
  )
}

describe("find-in-page reveal", () => {
  it("server render: closed content is hidden; hydration turns it into until-found", async () => {
    // React 19.3 serialises `hidden` as a boolean, so the server HTML can only say hidden=""
    // (known limitation, reported in the hand-off); the part upgrades it after hydration.
    const html = renderToString(<Example />)
    expect(html).toMatch(/data-part="content"[^>]* hidden=""/)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    await act(async () => {
      hydrateRoot(container, <Example />)
    })
    const content = container.querySelector('[data-part="content"]')
    expect(content?.getAttribute("hidden")).toBe(supported ? "until-found" : "")
    container.remove()
  })

  it.runIf(supported)("beforematch opens it with reason find-in-page and data-reveal", async () => {
    render(<Example />)
    const content = screen.getByText("Hidden treasure")
    expect(content.getAttribute("hidden")).toBe("until-found")
    // What Chromium does on a find-in-page match: remove hidden, then fire beforematch.
    await act(async () => {
      content.removeAttribute("hidden")
      content.dispatchEvent(new Event("beforematch", { bubbles: true }))
    })
    expect(content.hasAttribute("hidden")).toBe(false)
    expect(content.getAttribute("data-reveal")).toBe("find-in-page")
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true")
  })

  it.runIf(supported)(
    "a controlled parent that refuses: until-found again in the next frame",
    async () => {
      render(<Example open={false} />)
      const content = screen.getByText("Hidden treasure")
      await act(async () => {
        content.removeAttribute("hidden")
        content.dispatchEvent(new Event("beforematch", { bubbles: true }))
      })
      await frames()
      expect(content.getAttribute("hidden")).toBe("until-found")
    },
  )

  it.runIf(!supported)("without until-found support it is plain hidden", () => {
    render(<Example />)
    expect(screen.getByText("Hidden treasure").getAttribute("hidden")).toBe("")
  })

  it("deep link: a fragment target inside closed content opens it after hydration and scrolls to it", async () => {
    function Faq() {
      return (
        <Disclosure.Root hiddenUntilFound>
          <Disclosure.Trigger>Refunds</Disclosure.Trigger>
          <Disclosure.Content>
            <h3 id="refunds">Refund policy</h3>
          </Disclosure.Content>
        </Disclosure.Root>
      )
    }
    const html = renderToString(<Faq />)
    expect(html).toMatch(/data-part="content"[^>]* hidden=""/)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    }
    window.location.hash = "#refunds"
    try {
      await act(async () => {
        hydrateRoot(container, <Faq />)
      })
      await frames()
      const content = container.querySelector('[data-part="content"]')
      expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true")
      expect(content?.hasAttribute("hidden")).toBe(false)
      expect(content?.getAttribute("data-reveal")).toBe("find-in-page")
      expect(scrolled.map((e) => e.id)).toContain("refunds")
    } finally {
      Element.prototype.scrollIntoView = original
      history.replaceState(null, "", window.location.pathname + window.location.search)
      container.remove()
    }
  })

  it("no deep link: content stays closed after hydration", async () => {
    const html = renderToString(<Example />)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    await act(async () => {
      hydrateRoot(container, <Example />)
    })
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("false")
    container.remove()
  })
})
