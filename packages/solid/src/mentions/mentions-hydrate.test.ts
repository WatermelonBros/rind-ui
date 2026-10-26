// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Mentions on the server: the textarea carries its text as content (as React's markup), the
// Highlighter paints the mention, and it hydrates with no warning, the text still editable.
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Mentions server render and hydration", () => {
  it("the textarea's text is its content; hydrates with zero warnings", async () => {
    const server = await build("mentions/hydrate.tsx", "ssr")
    const client = await build("mentions/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const parsed = document.createElement("div")
    parsed.innerHTML = html
    const textarea = parsed.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.hasAttribute("value")).toBe(false)
    expect(textarea.textContent).toBe("Hi @Bob ")
    expect(parsed.querySelector('[data-part="mention"]')?.textContent).toBe("@Bob")

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const live = container.querySelector("textarea") as HTMLTextAreaElement
    expect(live.value).toBe("Hi @Bob ")
    dispose()
    container.remove()
  })
})
