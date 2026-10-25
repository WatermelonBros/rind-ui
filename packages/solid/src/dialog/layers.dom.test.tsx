/** @jsxImportSource solid-js */
// Nested layers: Escape closes the topmost only, and a layer opened inside another one is its
// child (a popover in a popover, a popover in a dialog).
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Dialog, Popover } from "../index"

/** A popover is clickable once placed (before that its positioner takes no pointer events). */
const clickable = async (name: string) => {
  const el = await screen.findByRole("button", { name })
  await vi.waitFor(() => expect(getComputedStyle(el).pointerEvents).not.toBe("none"))
  return el
}

const content = (children: unknown) => (
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Content aria-label="Panel">{children as never}</Popover.Content>
    </Popover.Positioner>
  </Popover.Portal>
)

describe("solid nested layers", () => {
  it("a popover in a popover: Escape closes the child, then the parent", async () => {
    const user = userEvent.setup()
    mount(() => (
      <Popover.Root>
        <Popover.Trigger>Outer</Popover.Trigger>
        {content(
          <Popover.Root>
            <Popover.Trigger>Inner</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Content aria-label="Inner panel">
                  <button type="button">Deep</button>
                </Popover.Content>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>,
        )}
      </Popover.Root>
    ))
    await user.click(screen.getByRole("button", { name: "Outer" }))
    await user.click(await clickable("Inner"))
    await screen.findByRole("dialog", { name: "Inner panel" })
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Inner panel" })).toBeNull())
    expect(screen.getByRole("dialog", { name: "Panel" })).toBeTruthy()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Panel" })).toBeNull())
  })

  it("a popover in a dialog: Escape closes the popover first", async () => {
    const user = userEvent.setup()
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Settings</Dialog.Title>
              <Popover.Root>
                <Popover.Trigger>Help</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Content aria-label="Help panel">
                      <button type="button">Docs</button>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    ))
    await user.click(screen.getByRole("button", { name: "Open dialog" }))
    await user.click(await clickable("Help"))
    await screen.findByRole("dialog", { name: "Help panel" })
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Help panel" })).toBeNull())
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull())
  })
})
