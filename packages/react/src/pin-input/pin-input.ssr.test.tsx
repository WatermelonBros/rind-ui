// The server render of a Pin Input (no DOM): defaultValue in the input and the slots.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PinInput } from "../index"

const tags = (out: string, part: string) => [
  ...out.matchAll(new RegExp(`<[a-z]+[^>]*data-part="${part}"[^>]*>([^<]*)`, "g")),
]
// HTML attribute names are case-insensitive (React's server render keeps camelCase).
const attr = (t: string, name: string) => new RegExp(` ${name}="([^"]*)"`, "i").exec(t)?.[1]

describe("PinInput server render", () => {
  const out = renderToString(
    <PinInput.Root length={6} defaultValue="12">
      <PinInput.Label>Verification code</PinInput.Label>
      <PinInput.Control>
        <PinInput.Input />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PinInput.Slot key={i} index={i} />
        ))}
      </PinInput.Control>
    </PinInput.Root>,
  )

  it("the input carries the value and the code attributes", () => {
    const input = tags(out, "input")[0]?.[0] ?? ""
    expect(attr(input, "value")).toBe("12")
    expect(attr(input, "autocomplete")).toBe("one-time-code")
    expect(attr(input, "maxlength")).toBe("6")
    expect(attr(input, "dir")).toBe("ltr")
    expect(attr(input, "id")).toBe(attr(tags(out, "label")[0]?.[0] ?? "", "for"))
  })

  it("six aria-hidden slots, the first two filled", () => {
    const slots = tags(out, "slot")
    expect(slots).toHaveLength(6)
    expect(slots.map((m) => m[1])).toEqual(["1", "2", "", "", "", ""])
    expect(slots.every((m) => attr(m[0], "aria-hidden") === "true")).toBe(true)
  })
})
