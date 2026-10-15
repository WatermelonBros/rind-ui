// Label scenarios that need real input and layout: hover, word selection, number spinners.
// Browser only (real mouse through vitest/browser).
import { Label } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { domEnv, type UserLike } from "../index"

const env = () =>
  domEnv({ user: userEvent as unknown as UserLike }).create({
    scope: "label",
    anchor: { role: "textbox" },
    modality: "pointer",
  })

describe("Label in a real browser", () => {
  it("hovering the label reaches the control (radix#1233)", async () => {
    render(
      <>
        <Label htmlFor="c">Accept</Label>
        <input id="c" type="checkbox" />
      </>,
    )
    await env().find({ text: "Accept" }).hover()
    await expect.poll(() => document.getElementById("c")?.matches(":hover")).toBe(true)
  })

  it("a double click on label text selects nothing", async () => {
    render(
      <>
        <Label htmlFor="a">Alpha beta</Label>
        <input id="a" />
      </>,
    )
    await env().find({ text: "Alpha beta" }).doubleClick()
    expect(window.getSelection()?.toString()).toBe("")
  })

  it("a double click on a word in a nested input selects the word (bits-ui#1323)", async () => {
    render(
      <Label>
        Name <input defaultValue="hello" />
      </Label>,
    )
    const input = screen.getByRole("textbox") as HTMLInputElement
    await userEvent.dblClick(input)
    expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("hello")
  })

  // The spin arrows are Chromium UI laid out at the input's right edge; other engines draw
  // them differently, so only the Chromium click geometry is known.
  it.skipIf(!navigator.userAgent.includes("Chrome"))(
    "a nested number input steps once per click (radix#2656)",
    async () => {
      render(
        <Label>
          Qty <input type="number" defaultValue={0} style={{ height: 40 }} />
        </Label>,
      )
      const input = screen.getByRole("spinbutton") as HTMLInputElement
      const box = input.getBoundingClientRect()
      const up = { x: box.width - 8, y: box.height / 2 - 4 }
      for (let i = 1; i <= 3; i++) {
        await userEvent.click(input, { position: up })
        expect(Number(input.value)).toBe(i)
      }
    },
  )
})
