// The server render of password and search Text Fields (no DOM).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TextField } from "../index"

const tag = (out: string, part: string) =>
  new RegExp(`<[a-z]+[^>]*data-part="${part}"[^>]*>`).exec(out)?.[0] ?? ""
// HTML attribute names are case-insensitive (React's server render keeps `spellCheck`).
const attr = (t: string, name: string) => new RegExp(` ${name}="([^"]*)"`, "i").exec(t)?.[1]

describe('TextField type="password" server render', () => {
  const render = (props: { defaultVisible?: boolean } = {}) =>
    renderToString(
      <TextField.Root type="password" {...props}>
        <TextField.Label>Password</TextField.Label>
        <TextField.Input />
        <TextField.VisibilityTrigger>
          <TextField.VisibilityIndicator />
        </TextField.VisibilityTrigger>
      </TextField.Root>,
    )

  it("hidden: type password, aria-pressed false, one name", () => {
    const out = render()
    expect(attr(tag(out, "input"), "type")).toBe("password")
    const trigger = tag(out, "visibility-trigger")
    expect(attr(trigger, "aria-pressed")).toBe("false")
    expect(attr(trigger, "aria-label")).toBe("Show password")
    expect(attr(trigger, "aria-controls")).toBeUndefined()
  })

  it("defaultVisible: type text, aria-pressed true, data-state visible", () => {
    const out = render({ defaultVisible: true })
    expect(attr(tag(out, "input"), "type")).toBe("text")
    expect(attr(tag(out, "visibility-trigger"), "aria-pressed")).toBe("true")
    expect(attr(tag(out, "visibility-indicator"), "data-state")).toBe("visible")
    expect(attr(tag(out, "input"), "spellcheck")).toBe("false")
  })
})

describe('TextField type="search" server render', () => {
  it("defaultValue with a ClearTrigger", () => {
    const out = renderToString(
      <TextField.Root type="search" defaultValue="dune">
        <TextField.Label>Search books</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
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
      <TextField.Root type="search">
        <TextField.Label>Search books</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    expect(tag(out, "root")).toContain('data-empty=""')
    expect(tag(out, "input")).toContain('data-empty=""')
    expect(tag(out, "clear-trigger")).toBe("")
  })

  it("a plain Text Field keeps type text semantics and no password attributes", () => {
    const out = renderToString(
      <TextField.Root type="email">
        <TextField.Label>Email</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    const input = tag(out, "input")
    expect(attr(input, "type")).toBe("email")
    expect(attr(input, "data-state")).toBeUndefined()
  })
})
