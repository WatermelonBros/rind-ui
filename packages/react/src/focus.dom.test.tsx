import { domEnvironment, focusAttrs } from "@rind-ui/core"
import { act, render, screen } from "@testing-library/react"
import { useMemo, useState } from "react"
import { describe, expect, it } from "vitest"
import { useModality } from "./index"

function Thumb() {
  const env = useMemo(() => domEnvironment(), [])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  // Subscribe the tracker for the whole test so it sees every input.
  useMemo(() => env.modality.subscribe(() => {}), [env])
  return (
    <button
      type="button"
      role="slider"
      aria-valuenow={1}
      aria-label="Volume"
      {...focusAttrs(focused, modality)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}

describe("focus attributes", () => {
  it("click → data-focus only; arrow → data-focus-visible, with no blur or focus event (BU#5296)", async () => {
    render(<Thumb />)
    const thumb = screen.getByRole("slider")
    await act(async () => {
      thumb.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
          width: 10,
          height: 10,
          pressure: 0.5,
        }),
      )
      thumb.focus()
    })
    expect(thumb.hasAttribute("data-focus")).toBe(true)
    expect(thumb.hasAttribute("data-focus-visible")).toBe(false)
    const events: string[] = []
    thumb.addEventListener("focus", () => events.push("focus"))
    thumb.addEventListener("blur", () => events.push("blur"))
    await act(async () => {
      thumb.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }))
    })
    expect(thumb.hasAttribute("data-focus-visible")).toBe(true)
    expect(events).toEqual([])
  })
})
