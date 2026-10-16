// The server render of a Password Input (no DOM): defaultVisible, the trigger's state.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PasswordInput } from "../index"

const tag = (out: string, part: string) =>
  new RegExp(`<[a-z]+[^>]*data-part="${part}"[^>]*>`).exec(out)?.[0] ?? ""
// HTML attribute names are case-insensitive (React's server render keeps `spellCheck`).
const attr = (t: string, name: string) => new RegExp(` ${name}="([^"]*)"`, "i").exec(t)?.[1]

describe("PasswordInput server render", () => {
  const render = (props: { defaultVisible?: boolean } = {}) =>
    renderToString(
      <PasswordInput.Root {...props}>
        <PasswordInput.Label>Password</PasswordInput.Label>
        <PasswordInput.Input />
        <PasswordInput.VisibilityTrigger>
          <PasswordInput.Indicator />
        </PasswordInput.VisibilityTrigger>
      </PasswordInput.Root>,
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
    expect(attr(tag(out, "indicator"), "data-state")).toBe("visible")
    expect(attr(tag(out, "input"), "spellcheck")).toBe("false")
  })
})
