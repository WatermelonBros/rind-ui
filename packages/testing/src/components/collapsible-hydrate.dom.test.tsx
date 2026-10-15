// Collapsible server markup hydrates with no warnings (4.3).
import { Collapsible } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const HEIGHT = "--rind-collapsible-content-height"
const tree = (props: { defaultOpen?: boolean } = {}): ReactNode => (
  <Collapsible.Root {...props}>
    <Collapsible.Trigger>Details</Collapsible.Trigger>
    <Collapsible.Content style={{ transition: "height 300ms" }}>Body text</Collapsible.Content>
  </Collapsible.Root>
)

async function hydrate(node: ReactNode) {
  const container = document.createElement("div")
  const html = renderToString(node)
  container.innerHTML = html
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const content = container.querySelector<HTMLElement>('[data-part="content"]')
  const triggerEl = container.querySelector<HTMLElement>('[data-part="trigger"]')
  const after = {
    hidden: content?.getAttribute("hidden"),
    height: content?.style.getPropertyValue(HEIGHT),
  }
  await act(async () => root?.unmount())
  container.remove()
  return { html, calls, after, triggerEl }
}

describe("Collapsible hydration", () => {
  it("default open: auto size, no hidden, zero warnings", async () => {
    const { html, calls, after } = await hydrate(tree({ defaultOpen: true }))
    expect(calls).toEqual([])
    expect(html).toContain("Body text")
    expect(html).toContain("--rind-collapsible-content-height:auto")
    expect(html).toContain('data-reveal="mount"')
    expect(html).not.toMatch(/ hidden/)
    expect(after.height).toBe("auto")
    expect(after.hidden).toBeNull()
  })

  it("closed until-found: text inside hidden in server HTML, upgraded after hydration", async () => {
    const { html, calls, after } = await hydrate(tree())
    expect(calls).toEqual([])
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*>Body text/)
    expect(html).not.toContain("aria-hidden")
    // jsdom has no onbeforematch: plain hidden stays.
    expect(after.hidden).toBe("onbeforematch" in document.body ? "until-found" : "")
    expect(after.height).toBe("0px")
  })

  it("server HTML has aria-controls pointing at the kept-mounted content", async () => {
    const { html } = await hydrate(tree())
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1]
    expect(controls).toBeTruthy()
    expect(html).toContain(`id="${controls}"`)
  })

  it("unmount mode: no aria-controls and no content when closed", async () => {
    const node = (
      <Collapsible.Root closedContent="unmount">
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body text</Collapsible.Content>
      </Collapsible.Root>
    )
    const { html, calls } = await hydrate(node)
    expect(calls).toEqual([])
    expect(html).not.toContain("aria-controls")
    expect(html).not.toContain("Body text")
  })
})

describe("review fixes (add-accordion r1)", () => {
  it("a consumer trigger id is rendered on the server", () => {
    const html = renderToString(
      <Collapsible.Root>
        <Collapsible.Trigger id="my-trigger">Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const box = document.createElement("div")
    box.innerHTML = html
    expect(box.querySelector("button")?.id).toBe("my-trigger")
  })
})
