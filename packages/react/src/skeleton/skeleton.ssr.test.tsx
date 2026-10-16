// The server render already carries the loading state (spec "Loading State").
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Skeleton } from "../index"

afterEach(() => vi.restoreAllMocks())

function html(node: React.ReactNode) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const out = renderToString(node)
  expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  return out
}

const card = (loading: boolean) => (
  <Skeleton.Root loading={loading}>
    <Skeleton.Status />
    <Skeleton.Content render={<ul />}>
      <li>
        <Skeleton.Item />
      </li>
      <li>
        <Skeleton.Item>
          <button type="button">Reply</button>
        </Skeleton.Item>
      </li>
    </Skeleton.Content>
  </Skeleton.Root>
)

describe("Skeleton server render", () => {
  it("loading: busy list, hidden and inert placeholders, Loading text", () => {
    const out = html(card(true))
    expect(out).toMatch(/<ul [^>]*aria-busy="true"/)
    expect(out).toContain(">Loading</span>")
    expect(out.match(/aria-hidden="true"/g)).toHaveLength(2)
    expect(out.match(/ inert=""/g)).toHaveLength(1)
    expect(out.match(/data-animate=""/g)).toHaveLength(2)
    expect(out).not.toMatch(/role=|aria-live/)
  })

  it("loaded: nothing hidden, no Status, no busy flag", () => {
    const out = html(card(false))
    expect(out).not.toMatch(/aria-busy|aria-hidden|inert|data-animate|Loading/)
    expect(out).toContain('data-state="loaded"')
  })

  it("consumer data-variant/size/tone pass through", () => {
    const out = html(
      <Skeleton.Root data-tone="danger">
        <Skeleton.Item data-size="lg" data-variant="x" />
      </Skeleton.Root>,
    )
    expect(out).toContain('data-tone="danger"')
    expect(out).toContain('data-size="lg"')
    expect(out).toContain('data-variant="x"')
  })
})
