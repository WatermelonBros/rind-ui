// The server render carries what a click before hydration needs (openspec label, no DOM).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Label } from "../index"

describe("Label server render", () => {
  it("is a <label> with for, id and scope attributes, no role or aria", () => {
    const out = renderToString(<Label htmlFor="email">Email</Label>)
    expect(out).toMatch(/^<label /)
    expect(out).toContain('for="email"')
    expect(out).toMatch(/ id="[^"]+"/)
    expect(out).toContain('data-scope="label"')
    expect(out).toContain('data-part="root"')
    expect(out).toContain("data-instance=")
    expect(out).toContain(">Email</label>")
    expect(out).not.toMatch(/role=|aria-/)
  })

  it("keeps the consumer's id", () => {
    expect(renderToString(<Label id="mine">A</Label>)).toContain('id="mine"')
  })

  it("the id is the same on every render", () => {
    const tree = () => (
      <>
        <Label htmlFor="a">A</Label>
        <Label htmlFor="b">B</Label>
      </>
    )
    expect(renderToString(tree())).toBe(renderToString(tree()))
  })

  it("keeps for on the server even when the tag is a label with an unknown target", () => {
    expect(renderToString(<Label htmlFor="ghost">G</Label>)).toContain('for="ghost"')
  })

  it("render={<span />} has no for", () => {
    const out = renderToString(
      <Label htmlFor="x" render={<span />}>
        S
      </Label>,
    )
    expect(out).toMatch(/^<span /)
    expect(out).not.toContain("for=")
  })
})
