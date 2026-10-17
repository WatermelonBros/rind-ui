// The adapters' `paste(text)` in the DOM adapter (the pw twin is in fixtures/text-field-password):
// the browser's order paste → beforeinput → input, the clipboard text, and prevention.
import { TextField } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { getTextField } from "./index"

let stop = () => {}
afterEach(() => stop())

function record(el: HTMLElement, prevent?: "paste" | "beforeinput") {
  const log: string[] = []
  const types = ["paste", "beforeinput", "input"] as const
  const on = (e: Event) => {
    const data =
      e.type === "paste"
        ? (e as ClipboardEvent).clipboardData?.getData("text/plain")
        : (e as InputEvent).inputType
    log.push(`${e.type}:${data}`)
    if (e.type === prevent) e.preventDefault()
  }
  for (const t of types) el.addEventListener(t, on)
  stop = () => {
    for (const t of types) el.removeEventListener(t, on)
  }
  return log
}

const field = () => {
  render(
    <TextField.Root defaultValue="ab">
      <TextField.Label>Name</TextField.Label>
      <TextField.Input />
    </TextField.Root>,
  )
  return getTextField(screen, { name: "Name" })
}
const input = () => screen.getByRole("textbox") as HTMLInputElement

describe("Part.paste", () => {
  it("fires paste → beforeinput → input with the clipboard text, and inserts at the caret", async () => {
    const t = field()
    const log = record(input())
    input().focus()
    input().setSelectionRange(1, 1)
    await t.part("input").paste("XY")
    expect(log).toEqual(["paste:XY", "beforeinput:insertFromPaste", "input:insertFromPaste"])
    expect(input().value).toBe("aXYb")
  })

  it("a prevented paste inserts nothing and fires nothing after it", async () => {
    const t = field()
    const log = record(input(), "paste")
    await t.part("input").paste("XY")
    expect(log).toEqual(["paste:XY"])
    expect(input().value).toBe("ab")
  })

  it("a prevented beforeinput inserts nothing", async () => {
    const t = field()
    const log = record(input(), "beforeinput")
    await t.part("input").paste("XY")
    expect(log).toEqual(["paste:XY", "beforeinput:insertFromPaste"])
    expect(input().value).toBe("ab")
  })
})
