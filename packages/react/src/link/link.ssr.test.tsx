// The server render carries every link attribute (openspec link-navigation, no DOM here).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Link, RouterProvider } from "../index"

const html = (node: React.ReactNode) => renderToString(node)

describe("Link server render", () => {
  it("an enabled link is a plain anchor with its href and no role or tabindex", () => {
    const out = html(<Link href="/a">A</Link>)
    expect(out).toMatch(/^<a /)
    expect(out).toContain('href="/a"')
    expect(out).toContain('data-scope="link"')
    expect(out).toContain('data-part="link"')
    expect(out).not.toMatch(/role=|tabindex=|aria-disabled|data-disabled|data-current/)
  })

  it("a disabled link has the disabled attributes and no href", () => {
    const out = html(
      <Link href="/a" disabled>
        A
      </Link>,
    )
    expect(out).not.toContain("href=")
    expect(out).toContain('role="link"')
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('tabindex="-1"')
    expect(out).toContain("data-disabled")
  })

  it("focusableWhenDisabled renders tabindex 0", () => {
    const out = html(
      <Link href="/a" disabled focusableWhenDisabled>
        A
      </Link>,
    )
    expect(out).toContain('tabindex="0"')
    expect(out).toContain('aria-disabled="true"')
  })

  it("a current link has aria-current and data-current and keeps its href", () => {
    const out = html(
      <Link href="/a" current="page">
        A
      </Link>,
    )
    expect(out).toContain('aria-current="page"')
    expect(out).toContain("data-current")
    expect(out).toContain('href="/a"')
  })

  it("render={<div />} gets role=link and tabindex=0", () => {
    const out = html(
      <Link href="/a" render={<div />}>
        A
      </Link>,
    )
    expect(out).toMatch(/^<div /)
    expect(out).toContain('role="link"')
    expect(out).toContain('tabindex="0"')
    expect(out).not.toContain("href=")
  })

  it("resolves the href through the router, never an external URL", () => {
    const out = html(
      <RouterProvider navigate={() => {}} href={(h) => `/app${h}`}>
        <Link href="/a">A</Link>
        <Link href="https://example.org/x">E</Link>
      </RouterProvider>,
    )
    expect(out).toContain('href="/app/a"')
    expect(out).toContain('href="https://example.org/x"')
    // The origin is unknown on the server: http(s) links are marked after hydration.
    expect(out).not.toContain("data-external")
    expect(html(<Link href="mailto:a@b.c">M</Link>)).toContain("data-external")
  })

  it("calls href() only for parts with an href (react-spectrum#9490)", () => {
    const calls: string[] = []
    html(
      <RouterProvider
        navigate={() => {}}
        href={(h) => {
          calls.push(h)
          return h
        }}
      >
        <Link>No href</Link>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    expect(calls).toEqual(["/a"])
  })
})
