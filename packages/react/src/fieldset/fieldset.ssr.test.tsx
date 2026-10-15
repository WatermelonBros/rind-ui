// The server render carries the group's name and description relations (openspec fieldset, no DOM).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Fieldset } from "../index"

const attr = (html: string, tag: string, name: string) =>
  new RegExp(`<${tag}\\b[^>]*? ${name}="([^"]*)"`).exec(html)?.[1]

describe("Fieldset server render", () => {
  it("is a fieldset whose first child is the legend, with scope attributes", () => {
    const out = renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
      </Fieldset.Root>,
    )
    expect(out).toMatch(/^<fieldset [^>]*>\s*<legend /)
    expect(out).toContain('data-scope="fieldset"')
    for (const part of ["root", "legend", "description"]) {
      expect(out).toContain(`data-part="${part}"`)
    }
    expect(out).toContain("data-instance=")
    expect(out).toContain(">Shipping address</legend>")
    // A native legend names the group: no role, no aria-labelledby.
    expect(out).not.toMatch(/role=|aria-labelledby=/)
    expect(out).not.toMatch(/ disabled=|data-disabled|data-invalid/)
  })

  // Relations to a Description or ErrorMessage exist only once those are rendered (after
  // commit), so the server never points at a missing id (ark#3707).
  it("Legend only: no aria-describedby on the server (ark#3707)", () => {
    const out = renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Contact</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(out).not.toContain("aria-describedby")
  })

  it("invalid without an ErrorMessage: no aria-describedby on the server", () => {
    const out = renderToString(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Contact</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(out).not.toContain("aria-describedby")
  })

  it("with a Description and an ErrorMessage, every relation on the server resolves", () => {
    const out = renderToString(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <Fieldset.Description>Help</Fieldset.Description>
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    for (const id of (attr(out, "fieldset", "aria-describedby") ?? "").split(" ").filter(Boolean)) {
      expect(out).toContain(`id="${id}"`)
    }
    expect(out).toContain(">Enter an address</p>")
    expect(out.match(/data-invalid/g)).toHaveLength(4)
  })

  it("renders no error message while valid", () => {
    const out = renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <Fieldset.ErrorMessage>Nope</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    expect(out).not.toContain("Nope")
    expect(out).not.toContain("error-message")
  })

  it("disabled has the attribute and data-disabled on root and legend", () => {
    const out = renderToString(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Contact</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(out).toMatch(/^<fieldset [^>]*\bdisabled=""/)
    expect(out.match(/data-disabled/g)).toHaveLength(2)
  })

  it("a substituted legend keeps its id; aria-labelledby appears after mount", () => {
    // The server cannot know the legend is substituted (it assumes native), so the relation
    // is added on the client (fieldset.dom.test.tsx / fieldset-hydrate.dom.test.tsx).
    const out = renderToString(
      <Fieldset.Root>
        <Fieldset.Legend render={<div />}>Contact</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(out).toMatch(/<div [^>]*data-part="legend"[^>]* id="[^"]+"/)
  })

  it("a substituted root is a group with aria-disabled", () => {
    const out = renderToString(
      <Fieldset.Root disabled render={<div />}>
        <Fieldset.Legend>Contact</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(out).toMatch(/^<div /)
    expect(out).toContain('role="group"')
    expect(out).toContain('aria-disabled="true"')
  })

  it("keeps the consumer's ids and the same output on every render", () => {
    const tree = () => (
      <Fieldset.Root id="f">
        <Fieldset.Legend id="l">L</Fieldset.Legend>
        <Fieldset.Description id="d">D</Fieldset.Description>
      </Fieldset.Root>
    )
    const out = renderToString(tree())
    expect(out).toContain('id="f"')
    expect(out).toContain('id="l"')
    expect(out).toContain('id="d"')
    expect(renderToString(tree())).toBe(out)
  })
})
