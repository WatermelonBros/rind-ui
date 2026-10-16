// The server render of a Search Field (no DOM): search semantics and the ClearTrigger.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SearchField } from "../index"

const tag = (out: string, part: string) =>
  new RegExp(`<[a-z]+[^>]*data-part="${part}"[^>]*>`).exec(out)?.[0] ?? ""
// HTML attribute names are case-insensitive (React's server render keeps `spellCheck`).
const attr = (t: string, name: string) => new RegExp(` ${name}="([^"]*)"`, "i").exec(t)?.[1]

describe("SearchField server render", () => {
  it("defaultValue with a ClearTrigger", () => {
    const out = renderToString(
      <SearchField.Root defaultValue="dune">
        <SearchField.Label>Search books</SearchField.Label>
        <SearchField.Input />
        <SearchField.ClearTrigger />
      </SearchField.Root>,
    )
    const input = tag(out, "input")
    expect(attr(input, "type")).toBe("search")
    expect(attr(input, "enterkeyhint")).toBe("search")
    expect(attr(input, "value")).toBe("dune")
    expect(input).not.toContain("data-empty")
    expect(attr(tag(out, "clear-trigger"), "aria-label")).toBe("Clear search")
  })

  it("empty: data-empty on root and input, no ClearTrigger", () => {
    const out = renderToString(
      <SearchField.Root>
        <SearchField.Label>Search books</SearchField.Label>
        <SearchField.Input />
        <SearchField.ClearTrigger />
      </SearchField.Root>,
    )
    expect(tag(out, "root")).toContain('data-empty=""')
    expect(tag(out, "input")).toContain('data-empty=""')
    expect(tag(out, "clear-trigger")).toBe("")
  })
})
