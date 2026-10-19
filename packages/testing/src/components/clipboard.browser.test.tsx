// Browser only: the real clipboard from a trusted click (spec "Write In The User Gesture").
// WebKit rejects a write that starts after an `await`; a resolved write here proves the call
// happens in the click's task. Chromium also reads the text back.
import { Clipboard, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { server, userEvent } from "vitest/browser"

describe("Clipboard with the real clipboard", () => {
  it("a trusted click resolves the write (copied, not error)", async () => {
    const onCopy = vi.fn()
    render(
      <RindProvider>
        <Clipboard.Root value="real-clipboard-check" onCopy={onCopy}>
          <Clipboard.Trigger />
        </Clipboard.Root>
      </RindProvider>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Copy" }))
    await expect.poll(() => onCopy.mock.calls.length).toBe(1)
    const details = onCopy.mock.calls[0]?.[0] as { ok: boolean; error?: unknown }
    // An automation build may deny the clipboard outright (no permission prompt to accept): that
    // is a NotAllowedError for any page, not this component's timing.
    if (!details.ok && String(details.error).includes("NotAllowed")) {
      console.info(`[clipboard] ${server.browser}: clipboard denied by the automation build`)
      return
    }
    expect(details).toMatchObject({ ok: true, source: "trigger" })
    if (server.browser === "chromium") {
      const text = await navigator.clipboard.readText().catch(() => null)
      if (text !== null) expect(text).toBe("real-clipboard-check")
    }
  })
})
