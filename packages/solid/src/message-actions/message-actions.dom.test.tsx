/** @jsxImportSource solid-js */
// Message Actions' Solid parts: one Toolbar Tab stop, shown by the message's hover and focus,
// copy at press time, regenerate busy until it settles, edit's pressed state and focus back,
// single deselectable feedback, versions.
import { fakeClipboard, getMessageActions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { MessageActions, RindProvider } from "../index"

/** Lets mount effects and promise callbacks run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

interface Props {
  count?: number
  text: string
}

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  const regenerated: number[] = []
  let finish: (() => void) | undefined
  const m = mount(
    (p: Props) => (
      <RindProvider announcer={rec.announcer} environment={{ clipboard }}>
        <article data-testid="message">
          <p>{p.text}</p>
          <MessageActions.Root
            count={p.count ?? 0}
            onRegenerate={() => {
              regenerated.push(1)
              return new Promise<void>((r) => {
                finish = r
              })
            }}
          >
            <MessageActions.Copy value={() => p.text}>⧉</MessageActions.Copy>
            <MessageActions.Regenerate>↻</MessageActions.Regenerate>
            <MessageActions.Edit>✎</MessageActions.Edit>
            <MessageActions.Feedback>
              <MessageActions.FeedbackItem value="up">👍</MessageActions.FeedbackItem>
              <MessageActions.FeedbackItem value="down">👎</MessageActions.FeedbackItem>
            </MessageActions.Feedback>
            <MessageActions.Versions>
              <MessageActions.VersionPrevious>‹</MessageActions.VersionPrevious>
              <MessageActions.VersionStatus />
              <MessageActions.VersionNext>›</MessageActions.VersionNext>
            </MessageActions.Versions>
          </MessageActions.Root>
        </article>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return {
    ...m,
    rec,
    clipboard,
    regenerated,
    finish: () => finish?.(),
    q,
    d: () => getMessageActions(document.body, { name: "Message actions" }),
  }
}

describe("Solid MessageActions", () => {
  it("is one named toolbar, one Tab stop, with named controls", async () => {
    const t = setup({ text: "Hello", count: 3 })
    await settle()
    const root = t.q('[data-scope="message-actions"][data-part="root"]')
    expect(root.getAttribute("role")).toBe("toolbar")
    expect(root.getAttribute("aria-label")).toBe("Message actions")
    const tabbable = [...root.querySelectorAll<HTMLElement>("button")].filter(
      (b) => b.tabIndex === 0,
    )
    expect(tabbable).toHaveLength(1)
    expect(t.q('[data-scope="clipboard"][data-part="trigger"]').getAttribute("aria-label")).toBe(
      "Copy",
    )
    expect(t.q('[data-part="regenerate"]').getAttribute("aria-label")).toBe("Regenerate")
    expect(t.q('[data-part="feedback"]').getAttribute("aria-label")).toBe("Feedback")
    expect(t.q('[data-part="feedback-item"][data-value="up"]').getAttribute("aria-label")).toBe(
      "Good response",
    )
    expect(t.q('[data-part="version-status"]').textContent).toBe("1 / 3")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("shows the row on the message's hover and focus", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    const d = t.d()
    expect(await d.isActive()).toBe(false)
    t.q('[data-testid="message"]').dispatchEvent(new PointerEvent("pointerenter"))
    expect(await d.isActive()).toBe(true)
    t.q('[data-testid="message"]').dispatchEvent(new PointerEvent("pointerleave"))
    expect(await d.isActive()).toBe(false)
    t.q('[data-part="regenerate"]').focus()
    expect(await d.isActive()).toBe(true)
  })

  it("copies the text at press time", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    await t.rerender({ text: "Hello, edited" })
    await t.d().via("pointer").copy()
    await vi.waitFor(() => expect(t.clipboard.copied).toEqual(["Hello, edited"]))
  })

  it("keeps Regenerate busy until its promise settles", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    const d = t.d()
    await d.via("keyboard").regenerate()
    expect(t.regenerated).toEqual([1])
    expect(await d.regenerateState()).toBe("pending")
    const button = t.q('[data-part="regenerate"]')
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.getAttribute("aria-disabled")).toBe("true")
    button.click()
    expect(t.regenerated).toEqual([1])
    t.finish()
    await vi.waitFor(async () => expect(await d.regenerateState()).toBe("done"))
  })

  it("toggles editing and brings the focus back to Edit", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    const d = t.d()
    const edit = t.q('[data-part="edit"]')
    await d.via("pointer").edit()
    expect(await d.isEditing()).toBe(true)
    expect(edit.getAttribute("aria-pressed")).toBe("true")
    ;(document.activeElement as HTMLElement | null)?.blur()
    await d.via("pointer").edit()
    expect(await d.isEditing()).toBe(false)
    expect(document.activeElement).toBe(edit)
  })

  it("rates with a single, deselectable choice", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    const d = t.d()
    await d.via("pointer").rate("up")
    expect(await d.rating()).toBe("up")
    await d.via("pointer").rate("down")
    expect(await d.rating()).toBe("down")
    await d.via("pointer").rate("down")
    expect(await d.rating()).toBe(null)
  })

  it("moves between versions and announces them; no versions below two", async () => {
    const t = setup({ text: "Hello", count: 2 })
    await settle()
    const d = t.d()
    expect(t.q('[data-part="version-previous"]').getAttribute("aria-disabled")).toBe("true")
    await d.via("pointer").nextVersion()
    expect(await d.version()).toEqual({ index: 1, count: 2 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Version 2 of 2"])
    await t.rerender({ count: 1 })
    expect(t.q('[data-part="versions"]')).toBeNull()
  })
})
