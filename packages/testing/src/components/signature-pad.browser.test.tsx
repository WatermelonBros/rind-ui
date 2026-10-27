// Signature Pad (React) in a real browser (drawing needs layout): strokes, a second pointer
// ignored, clear and undo keeping focus and announcing, the form value, required and reset.
import { RindProvider, SignaturePad, type SignaturePadRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSignaturePad, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

function Pad(props: Partial<SignaturePadRootProps>) {
  return (
    <SignaturePad.Root name="signature" {...props}>
      <SignaturePad.Label>Signature</SignaturePad.Label>
      <SignaturePad.Control style={{ width: 300, height: 120, display: "block" }}>
        <SignaturePad.Segment />
        <SignaturePad.Guide />
      </SignaturePad.Control>
      <SignaturePad.Status />
      <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
      <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
    </SignaturePad.Root>
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  render(<RindProvider announcer={rec.announcer}>{node}</RindProvider>)
  return { log: rec.log, d: getSignaturePad(screen, { label: "Signature" }) }
}

const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-scope="signature-pad"][data-part="${name}"]`)

describe("signature pad drawing", () => {
  it("a stroke becomes ink and the value; a tap is a dot", async () => {
    const onValueChange = vi.fn()
    const { d } = setup(<Pad onValueChange={onValueChange} />)
    await d.draw()
    expect(await d.strokeCount()).toBe(1)
    expect(await d.isEmpty()).toBe(false)
    expect(await d.statusText()).toBe("Signed")
    expect(await d.clearDisabled()).toBe(false)
    await d.tap()
    expect(await d.strokeCount()).toBe(2)
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(onValueChange.mock.calls[1]?.[0].strokes).toHaveLength(2)
    expect(await d.formValue()).toMatch(/^data:image\/svg\+xml/)
  })

  it("a second finger is ignored: one stroke", async () => {
    const { d } = setup(<Pad />)
    await d.drawWithTwoPointers()
    expect(await d.strokeCount()).toBe(1)
  })

  it("a cancelled stroke is still ink", async () => {
    const { d } = setup(<Pad />)
    await d.cancelStroke()
    expect(await d.strokeCount()).toBe(1)
  })

  it.each([{ disabled: true }, { readOnly: true }])("%o draws nothing", async (flags) => {
    const { d } = setup(<Pad {...flags} />)
    await d.draw()
    expect(await d.strokeCount()).toBe(0)
  })
})

describe("signature pad clear and undo", () => {
  it("undo removes the last stroke, clear the rest; both announce and keep focus", async () => {
    const { d, log } = setup(<Pad />)
    await d.draw()
    await d.tap()
    const user = userEvent.setup()
    const undo = screen.getByRole("button", { name: "Undo Signature" })
    await user.click(undo)
    expect(await d.strokeCount()).toBe(1)
    const clear = screen.getByRole("button", { name: "Clear Signature" })
    clear.focus()
    await user.keyboard("{Enter}")
    expect(await d.isEmpty()).toBe(true)
    expect(document.activeElement).toBe(clear)
    expect(clear.getAttribute("aria-disabled")).toBe("true")
    expect(clear.hasAttribute("hidden")).toBe(false)
    expect(log.map((a) => [a.message, a.priority])).toEqual([
      ["Last stroke removed", "polite"],
      ["Signature cleared", "polite"],
    ])
    await user.keyboard("{Enter}")
    expect(log).toHaveLength(2)
  })
})

describe("signature pad form", () => {
  it("required blocks submit while empty; the value submits once signed; reset empties it", async () => {
    const submitted: string[] = []
    const { d } = setup(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitted.push(String(new FormData(e.currentTarget).get("signature")))
        }}
      >
        <Pad required />
        <button type="submit">Send</button>
        <button type="reset">Reset</button>
      </form>,
    )
    const input = part("hidden-input") as HTMLInputElement
    expect(input.readOnly).toBe(false)
    expect(input.checkValidity()).toBe(false)
    await d.draw()
    expect(input.checkValidity()).toBe(true)
    await userEvent.setup().click(screen.getByRole("button", { name: "Send" }))
    expect(submitted).toHaveLength(1)
    expect(submitted[0]).toMatch(/^data:image\/svg\+xml/)
    await act(async () => {
      ;(input.form as HTMLFormElement).reset()
    })
    await vi.waitFor(async () => expect(await d.isEmpty()).toBe(true))
    expect(input.value).toBe("")
  })

  it('formValue="json" submits the strokes', async () => {
    const { d } = setup(<Pad formValue="json" />)
    await d.tap()
    const parsed = JSON.parse(await d.formValue()) as { strokes: unknown[] }
    expect(parsed.strokes).toHaveLength(1)
  })
})
