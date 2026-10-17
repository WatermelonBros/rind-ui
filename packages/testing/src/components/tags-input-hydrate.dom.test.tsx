// Server markup hydrates without a mismatch in Strict Mode; the carriers are in the HTML.
import { TagsInput } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (
  <form>
    <TagsInput.Root name="to" defaultValue={["a@x.io", "b@x.io"]}>
      <TagsInput.Label>To</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Chips />
        <TagsInput.Input />
      </TagsInput.Control>
    </TagsInput.Root>
  </form>
)

describe("Tags Input hydration", () => {
  it("no mismatch; the server HTML has one carrier per tag and the summary", async () => {
    const html = renderToString(tree)
    expect(html.match(/type="hidden" name="to"/g)?.length).toBe(2)
    expect(html).toContain("2 tags: a@x.io, b@x.io")
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
        onRecoverableError: (e) => error(String(e)),
      })
    })
    expect(error.mock.calls).toEqual([])
    const data = [...new FormData(container.querySelector("form") as HTMLFormElement).entries()]
    expect(data.map(([k, v]) => `${k}=${v}`)).toEqual(["to=a@x.io", "to=b@x.io"])
    await act(async () => root?.unmount())
    container.remove()
  })
})
