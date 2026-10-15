// The server render carries every heading attribute (openspec heading, no DOM here).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Heading } from "../index"

const html = (node: React.ReactNode) => renderToString(node)

describe("Heading server render", () => {
  it("default is an h2 with no role or aria-level", () => {
    const out = html(<Heading>Settings</Heading>)
    expect(out).toMatch(/^<h2 /)
    expect(out).toContain(">Settings</h2>")
    expect(out).toContain('data-scope="heading"')
    expect(out).toContain('data-part="root"')
    expect(out).not.toMatch(/role=|aria-level/)
  })

  it("nested Levels give h2, h3, h4", () => {
    const out = html(
      <>
        <Heading>A</Heading>
        <Heading.Level>
          <Heading>B</Heading>
          <Heading.Level>
            <Heading>C</Heading>
          </Heading.Level>
        </Heading.Level>
      </>,
    )
    expect(out).toMatch(/<h2 [^>]*>A<\/h2><h3 [^>]*>B<\/h3><h4 [^>]*>C<\/h4>/)
    expect(out).toContain('data-level="3"')
  })

  it("render={<div />} adds role and aria-level", () => {
    const out = html(
      <Heading.Level>
        <Heading render={<div />}>D</Heading>
      </Heading.Level>,
    )
    expect(out).toMatch(/^<div /)
    expect(out).toContain('role="heading"')
    expect(out).toContain('aria-level="3"')
  })

  it("render={<h4 />} at level 2 has aria-level and no role", () => {
    // biome-ignore lint/a11y/useHeadingContent: Heading supplies the children
    const out = html(<Heading render={<h4 />}>H</Heading>)
    expect(out).toMatch(/^<h4 /)
    expect(out).toContain('aria-level="2"')
    expect(out).not.toContain("role=")
  })

  it("emits data-level and passes data-variant, data-size, data-tone through", () => {
    const out = html(
      <Heading level={5} data-variant="v" data-size="lg" data-tone="muted">
        X
      </Heading>,
    )
    expect(out).toContain('data-level="5"')
    expect(out).toContain('data-variant="v"')
    expect(out).toContain('data-size="lg"')
    expect(out).toContain('data-tone="muted"')
  })

  it("depth 7 renders h6", () => {
    const out = html(
      <Heading.Level level={6}>
        <Heading.Level>
          <Heading>Deep</Heading>
        </Heading.Level>
      </Heading.Level>,
    )
    expect(out).toMatch(/^<h6 /)
    expect(out).toContain('data-level="6"')
  })
})
