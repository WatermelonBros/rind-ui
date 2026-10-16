// Alert Dialog against real layout, animation and input (openspec add-alert-dialog 5.1, 6.1,
// 4.2). Every pw fixture runs against the built Storybook, which is being retired, so the
// Playwright-level checks live here as browser tests; the forced-colors and reduced-motion
// rules are checked as CSS rules in packages/theme/src/alert-dialog.browser.test.tsx.
import { AlertDialog } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { getAlertDialog } from "../index"

const EXIT = "rind-test-alert-exit"
const css = (ms: number) => (
  <style>{`@keyframes ${EXIT} { from { opacity: 1 } to { opacity: 0 } }
[data-part="backdrop"], [data-part="positioner"] { position: fixed; inset: 0 }
[data-part="content"][data-state="closed"] { animation: ${EXIT} ${ms}ms linear forwards }`}</style>
)
const content = () => document.querySelector<HTMLElement>('[data-part="content"]')
const frames = async (count = 6) => {
  for (let i = 0; i < count; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function Fixture({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <>
      {css(400)}
      <AlertDialog.Root {...(onOpenChange ? { onOpenChange } : {})}>
        <AlertDialog.Trigger>Delete project?</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Positioner>
            <AlertDialog.Content>
              <AlertDialog.Title>Delete project?</AlertDialog.Title>
              <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action>Delete</AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}

const part = (name: string) => {
  const el = document.querySelector<HTMLElement>(`[data-part="${name}"]`)
  if (!el) throw new Error(`no ${name}`)
  return el
}

describe("Alert Dialog in a real browser", () => {
  it("keeps the content during the exit with data-state closed and data-close-reason action-press", async () => {
    render(<Fixture />)
    await userEvent.click(part("trigger"))
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("open")
    await userEvent.click(part("action"))
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("closed")
    expect(content()?.getAttribute("data-close-reason")).toBe("action-press")
    await frames()
    expect(content()).not.toBeNull()
    await expect.poll(() => content(), { timeout: 3000 }).toBeNull()
  })

  it("a real click on the positioner beside the content stays open and calls no onOpenChange (radix#1738)", async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await userEvent.click(part("trigger"))
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("open")
    onOpenChange.mockClear()
    await userEvent.click(part("positioner"), { position: { x: 4, y: 4 } })
    await frames()
    expect(content()?.getAttribute("data-state")).toBe("open")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("Cancel is focused on open with the real keyboard", async () => {
    render(<Fixture />)
    // Safari does not Tab to buttons by default: focus the trigger, then use the keyboard.
    part("trigger").focus()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => document.activeElement?.getAttribute("data-part")).toBe("cancel")
    expect(document.activeElement?.hasAttribute("data-focus-visible")).toBe(true)
  })

  it.each(["pointer", "keyboard", "touch", "virtual"] as const)(
    "driver round trip in %s: open, confirm Delete, closeReason action-press",
    async (modality) => {
      render(<Fixture />)
      const a = getAlertDialog(screen, { name: "Delete project?" }).via(modality as never)
      await a.open()
      expect(await a.isOpen()).toBe(true)
      await a.confirm("Delete")
      expect(await a.isOpen()).toBe(false)
      expect(await a.closeReason()).toBe("action-press")
    },
  )
})
