// add-tour 4.3: a `defaultOpen` tour renders nothing of the tour on the server, hydrates
// without a mismatch, then starts once its targets exist.
import { Tour } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  document.body.replaceChildren()
})

function App() {
  return (
    <StrictMode>
      <button type="button" id="search">
        Search
      </button>
      <Tour.Root
        defaultOpen
        steps={[{ id: "search", title: "Search", target: () => document.getElementById("search") }]}
      >
        <Tour.Trigger>Take the tour</Tour.Trigger>
        <Tour.Backdrop />
        <Tour.Positioner>
          <Tour.Content>
            <Tour.Title />
          </Tour.Content>
        </Tour.Positioner>
      </Tour.Root>
    </StrictMode>
  )
}

it("server HTML has no backdrop, card or mark; hydration logs nothing; the tour starts after", async () => {
  const html = renderToString(<App />)
  expect(html).not.toContain('data-part="backdrop"')
  expect(html).not.toContain('data-part="content"')
  expect(html).not.toContain("data-rind-tour-target")
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <App />, { onRecoverableError: (e) => error(String(e)) })
  })
  await vi.waitFor(() =>
    expect(container.querySelector('[data-part="content"]')?.getAttribute("data-step")).toBe(
      "search",
    ),
  )
  expect(error).not.toHaveBeenCalled()
  expect(document.querySelectorAll('[data-part="content"]')).toHaveLength(1)
  await act(async () => root?.unmount())
  expect(document.querySelector("[data-rind-tour-target]")).toBeNull()
  error.mockRestore()
})
