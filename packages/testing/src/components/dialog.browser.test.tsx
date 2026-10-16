// Dialog against real layout and animation (openspec add-dialog: Mounting, Initial Focus,
// Data Attributes).
import { Dialog } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"

const EXIT = "rind-test-dialog-exit"
const css = (ms: number) => (
  <style>{`@keyframes ${EXIT} { from { opacity: 1 } to { opacity: 0 } }
[data-part="backdrop"], [data-part="positioner"] { position: fixed; inset: 0 }
[data-part="content"][data-state="closed"] { animation: ${EXIT} ${ms}ms linear forwards }`}</style>
)
const content = () => document.querySelector<HTMLElement>('[data-part="content"]')
const frames = async (count = 6) => {
  for (let i = 0; i < count; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function Fixture({
  ms = 400,
  onOpenChange,
  autofocus = false,
}: {
  ms?: number
  onOpenChange?: (open: boolean) => void
  autofocus?: boolean
}) {
  return (
    <>
      {css(ms)}
      <div style={{ height: 3000 }} />
      <Dialog.Root {...(onOpenChange ? { onOpenChange } : {})}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Edit profile</Dialog.Title>
              <button type="button">First</button>
              <input aria-label="Name" {...(autofocus ? { "data-autofocus": "" } : {})} />
              <Dialog.CloseTrigger>Close dialog</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

const trigger = () => {
  const el = document.querySelector<HTMLElement>('[data-part="trigger"]')
  if (!el) throw new Error("no trigger")
  return el
}

describe("Dialog in a real browser", () => {
  it("keeps the content during the exit animation with data-state closed and the reason", async () => {
    render(<Fixture />)
    await userEvent.click(trigger())
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("open")
    await userEvent.keyboard("{Escape}")
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("closed")
    expect(content()?.getAttribute("data-close-reason")).toBe("escape-key")
    await frames()
    expect(content()).not.toBeNull()
    await expect.poll(() => content(), { timeout: 3000 }).toBeNull()
  })

  it("a second click on the close trigger during a 400 ms exit calls onOpenChange once (base-ui#3153)", async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await userEvent.click(trigger())
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("open")
    onOpenChange.mockClear()
    const close = document.querySelector<HTMLElement>('[data-part="close-trigger"]')
    if (!close) throw new Error("no close trigger")
    await userEvent.dblClick(close)
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("closed")
    await frames()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
    await expect.poll(() => content(), { timeout: 3000 }).toBeNull()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("data-autofocus in a portalled dialog on a scrolled page keeps the scroll (react-spectrum#4898)", async () => {
    render(<Fixture autofocus />)
    window.scrollTo(0, document.documentElement.scrollHeight)
    await expect.poll(() => window.scrollY).toBeGreaterThan(2000)
    const before = window.scrollY
    await userEvent.click(trigger())
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("Name")
    // Stable across several frames: a late focus-induced scroll would show up here.
    await frames()
    expect(window.scrollY).toBe(before)
    window.scrollTo(0, 0)
  })
})
