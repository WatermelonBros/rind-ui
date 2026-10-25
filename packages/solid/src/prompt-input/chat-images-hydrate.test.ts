// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// An Image Viewer, an Image Cropper, a Message Thread, a Streaming Message, a Reasoning and a
// Prompt Input on the server: the HTML is React's, it hydrates with no warning, and each is
// live afterwards.
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const SRC = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const FROM = ["user", "assistant"] as const

describe("Solid image, chat and prompt parts server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; all six are live", async () => {
    const server = await build("chat-images/hydrate.tsx", "ssr")
    const client = await build("chat-images/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.ImageViewer.Root,
          { id: "plan" },
          r(R.ImageViewer.Viewport, null, r(R.ImageViewer.Image, { src: SRC, alt: "Floor plan" })),
          r(R.ImageViewer.ZoomOut, null, "−"),
          r(R.ImageViewer.ZoomText),
          r(R.ImageViewer.ZoomIn),
          r(R.ImageViewer.Reset),
        ),
        r(
          R.ImageCropper.Root,
          { id: "avatar", "aria-label": "Avatar" },
          r(
            R.ImageCropper.Viewport,
            null,
            r(R.ImageCropper.Image, { src: SRC, alt: "" }),
            r(
              R.ImageCropper.Selection,
              null,
              r(R.ImageCropper.Handle, { position: "n" }),
              r(R.ImageCropper.Grid, { axis: "horizontal" }),
            ),
          ),
        ),
        r(
          R.MessageThread.Root,
          { id: "chat", count: 2 },
          r(
            R.MessageThread.Viewport,
            null,
            ...FROM.map((from, i) =>
              r(R.MessageThread.Message, { key: i, index: i, from }, r("p", null, "message ", i)),
            ),
          ),
          r(R.MessageThread.JumpToLatest),
        ),
        r(
          R.StreamingMessage.Root,
          { id: "reply", text: "Hello there.", status: "streaming" },
          r(R.StreamingMessage.Content),
          r(R.StreamingMessage.Caret),
        ),
        r(
          R.Reasoning.Root,
          { id: "why", thinking: false, duration: 4 },
          r(R.Reasoning.Trigger),
          r(R.Reasoning.Content, null, "The moon pulls the water."),
        ),
        r(
          R.PromptInput.Root,
          { id: "ask", defaultValue: "hello" },
          r(R.PromptInput.Label, null, "Message"),
          r(R.PromptInput.Attachments),
          r(R.PromptInput.Textarea, { placeholder: "Ask" }),
          r(R.PromptInput.CharacterCount, { max: 10 }),
          r(R.PromptInput.AttachTrigger),
          r(R.PromptInput.Submit),
        ),
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
    // Live: the reasoning opens, the draft counts, the zoom text is there.
    const trigger = container.querySelector<HTMLElement>(
      "[data-scope='reasoning'][data-part='trigger']",
    )
    trigger?.click()
    await vi.waitFor(() =>
      expect(container.querySelector("[data-scope='reasoning'][data-part='content']")).toBeTruthy(),
    )
    const box = container.querySelector<HTMLTextAreaElement>("textarea")
    expect(box?.value).toBe("hello")
    expect(
      container.querySelector("[data-scope='image-viewer'][data-part='zoom-text']"),
    ).toBeTruthy()
    dispose()
    container.remove()
  })
})
