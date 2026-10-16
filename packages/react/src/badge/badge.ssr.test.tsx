// The server render carries every badge attribute (openspec badge, no DOM here).
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Badge } from "../index"

afterEach(() => vi.restoreAllMocks())

/** Renders and fails on any console warning or error (zero warnings). */
function html(node: React.ReactNode) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const out = renderToString(node)
  expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  return out
}

describe("Badge server render", () => {
  it("text badge: one span, no role, no live attributes", () => {
    const out = html(<Badge.Root>Beta</Badge.Root>)
    expect(out).toMatch(/^<span [^>]*>Beta<\/span>$/)
    expect(out).toContain('data-scope="badge"')
    expect(out).toContain('data-part="root"')
    expect(out).toContain("data-instance=")
    expect(out).not.toMatch(/role=|aria-live|aria-atomic|aria-relevant|tabindex/)
  })

  it("label: content aria-hidden, label a text node (not an attribute)", () => {
    const out = html(<Badge.Root label="3 unread">3</Badge.Root>)
    expect(out).toContain('<span aria-hidden="true">3</span>')
    expect(out).toMatch(/<span data-visually-hidden="" style="[^"]+">3 unread<\/span>/)
    expect(out).not.toContain("aria-label")
  })

  it("the id is the consumer's", () => {
    expect(html(<Badge.Root id="c">3</Badge.Root>)).toContain('id="c"')
  })

  it("passes data-variant, data-size, data-tone and role through", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const out = renderToString(
      <Badge.Root data-variant="solid" data-size="sm" data-tone="danger" role="status">
        2
      </Badge.Root>,
    )
    expect(out).toContain('data-variant="solid"')
    expect(out).toContain('data-size="sm"')
    expect(out).toContain('data-tone="danger"')
    expect(out).toContain('role="status"')
    // Effects do not run on the server: the dev warning comes after mount.
    expect(warn).not.toHaveBeenCalled()
  })

  it("render substitutes the element", () => {
    expect(html(<Badge.Root render={<strong />}>New</Badge.Root>)).toMatch(/^<strong /)
  })
})
