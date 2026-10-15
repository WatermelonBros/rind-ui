// The server render carries every separator attribute (openspec separator, no DOM here).
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Separator, SeparatorHostContext } from "../index"

afterEach(() => vi.restoreAllMocks())

/** Renders and fails on any console warning or error (zero warnings). */
function html(node: React.ReactNode) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const out = renderToString(node)
  expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  return out
}

describe("Separator server render", () => {
  it("div: role separator, own data attributes, no aria-orientation", () => {
    const out = html(<Separator.Root />)
    expect(out).toMatch(/^<div /)
    expect(out).toContain('role="separator"')
    expect(out).toContain('data-scope="separator"')
    expect(out).toContain('data-part="root"')
    expect(out).toContain('data-orientation="horizontal"')
    expect(out).not.toContain("aria-orientation")
  })

  it("hr: no role and no children even when children are passed (ark#3555)", () => {
    const out = html(<Separator.Root render={<hr />}>text</Separator.Root>)
    expect(out).toMatch(/^<hr /)
    expect(out).not.toContain("role=")
    expect(out).not.toContain("text")
    expect(out).not.toContain("</hr>")
  })

  it("vertical div has aria-orientation", () => {
    const out = html(<Separator.Root orientation="vertical" />)
    expect(out).toContain('aria-orientation="vertical"')
    expect(out).toContain('data-orientation="vertical"')
  })

  it("passes data-variant, data-size and data-tone through", () => {
    const out = html(<Separator.Root data-variant="v" data-size="lg" data-tone="muted" />)
    expect(out).toContain('data-variant="v"')
    expect(out).toContain('data-size="lg"')
    expect(out).toContain('data-tone="muted"')
  })

  it("decorative drops aria-label and is role none", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const out = renderToString(<Separator.Root decorative aria-label="x" />)
    expect(out).toContain('role="none"')
    expect(out).toContain("data-decorative")
    expect(out).not.toContain("aria-label")
    // Effects do not run on the server: the dev warning comes after mount.
    expect(warn).not.toHaveBeenCalled()
  })

  it("a semantic separator keeps its aria-label", () => {
    expect(html(<Separator.Root aria-label="Advanced" />)).toContain('aria-label="Advanced"')
  })

  it("a toolbar host gives vertical by default, explicit horizontal wins", () => {
    const host = { context: "toolbar", defaultOrientation: "vertical" } as const
    const out = html(
      <SeparatorHostContext value={host}>
        <Separator.Root />
        <Separator.Root orientation="horizontal" />
      </SeparatorHostContext>,
    )
    const [first = "", second = ""] = out.split("<div ").slice(1)
    expect(first).toContain('data-orientation="vertical"')
    expect(first).toContain('aria-orientation="vertical"')
    expect(second).toContain('data-orientation="horizontal"')
    expect(second).not.toContain("aria-orientation")
  })

  it("a listbox host forces role none", () => {
    const out = html(
      <SeparatorHostContext value={{ context: "listbox" }}>
        <Separator.Root orientation="vertical" aria-label="x" />
      </SeparatorHostContext>,
    )
    expect(out).toContain('role="none"')
    expect(out).not.toContain("aria-orientation")
    expect(out).not.toContain("aria-label")
    expect(out).toContain("data-decorative")
  })
})
