// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A Form with a Text Field, a File Upload and a Clipboard on the server: the HTML is React's,
// hydrates with no warning, and the controls stay live.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

describe("Solid Form, File Upload and Clipboard server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; controls stay live", async () => {
    const server = await build("form-upload/hydrate.tsx", "ssr")
    const client = await build("form-upload/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        R.Form.Root,
        { "aria-label": "Profile" },
        r(
          R.TextField.Root,
          { name: "handle", required: true },
          r(R.TextField.Label, null, "Handle"),
          r(R.TextField.Input),
          r(R.TextField.ErrorMessage),
        ),
        r(
          R.FileUpload.Root,
          { name: "docs" },
          r(R.FileUpload.Label, null, "Documents"),
          r(
            R.FileUpload.Dropzone,
            null,
            "Drop files here",
            r(R.FileUpload.Trigger, null, "Choose file"),
          ),
        ),
        r(
          R.Clipboard.Root,
          { value: "sk-123" },
          r(R.Clipboard.Label, null, "API key"),
          r(
            R.Clipboard.Control,
            null,
            r(R.Clipboard.Input),
            r(R.Clipboard.Trigger, null, r(R.Clipboard.Indicator, null, "⧉")),
          ),
        ),
        r("button", { type: "submit" }, "Save"),
      ),
    )
    expect(canonicalHtml(withoutHydrationKeys(html))).toBe(canonicalHtml(react))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const input = container.querySelector("input[name='handle']") as HTMLInputElement
    input.value = "ada"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const trigger = container.querySelector("[data-scope='file-upload'][data-part='trigger']")
    expect(trigger?.getAttribute("aria-label") ?? trigger?.textContent).toBeTruthy()
    await vi.waitFor(() => expect(input.value).toBe("ada"))
    dispose()
    container.remove()
  })
})
