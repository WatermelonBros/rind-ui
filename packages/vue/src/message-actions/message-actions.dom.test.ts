// Message Actions' Vue parts: one Toolbar Tab stop, shown by the message's hover and focus,
// copy at press time, regenerate busy until it settles, edit's pressed state and focus back,
// single deselectable feedback, versions, and markup parity with React.
import * as R from "@rind-ui/react"
import { fakeClipboard, getMessageActions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { MessageActions, RindProvider } from "../index"

/** Lets mount effects and promise callbacks run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  await nextTick()
}

interface Props {
  count?: number
  text: string
}

const row = (count: number, copy: string | (() => string), onRegenerate?: () => Promise<void>) =>
  h(MessageActions.Root, { count, ...(onRegenerate ? { onRegenerate } : {}) }, () => [
    h(MessageActions.Copy, { value: copy }, () => "⧉"),
    h(MessageActions.Regenerate, null, () => "↻"),
    h(MessageActions.Edit, null, () => "✎"),
    h(MessageActions.Feedback, null, () => [
      h(MessageActions.FeedbackItem, { value: "up" }, () => "👍"),
      h(MessageActions.FeedbackItem, { value: "down" }, () => "👎"),
    ]),
    h(MessageActions.Versions, null, () => [
      h(MessageActions.VersionPrevious, null, () => "‹"),
      h(MessageActions.VersionStatus),
      h(MessageActions.VersionNext, null, () => "›"),
    ]),
  ])

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  const regenerated: number[] = []
  let finish: (() => void) | undefined
  const m = mount(
    (p: Props) =>
      h(RindProvider, { announcer: rec.announcer, environment: { clipboard } }, () =>
        h("article", { "data-testid": "message" }, [
          h("p", null, p.text),
          row(
            p.count ?? 0,
            () => p.text,
            () => {
              regenerated.push(1)
              return new Promise<void>((res) => {
                finish = res
              })
            },
          ),
        ]),
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

describe("Vue MessageActions", () => {
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
    await nextTick()
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
    t.q('[data-part="regenerate"]').click()
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
    await d.via("pointer").rate("up")
    expect(await d.rating()).toBe(null)
  })

  it("moves between versions and announces them", async () => {
    const t = setup({ text: "Hello", count: 2 })
    await settle()
    const d = t.d()
    await d.via("pointer").nextVersion()
    expect(await d.version()).toEqual({ index: 1, count: 2 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Version 2 of 2"])
  })

  it("matches React's markup, server and client", async () => {
    const react = r(
      R.MessageActions.Root,
      { count: 2 },
      r(R.MessageActions.Copy, { key: "c", value: "Hello" }, "⧉"),
      r(R.MessageActions.Edit, { key: "e" }, "✎"),
      r(
        R.MessageActions.Versions,
        { key: "v" },
        r(R.MessageActions.VersionPrevious, { key: "p" }, "‹"),
        r(R.MessageActions.VersionStatus, { key: "s" }),
      ),
    )
    const vue = () =>
      h(MessageActions.Root, { count: 2 }, () => [
        h(MessageActions.Copy, { value: "Hello" }, () => "⧉"),
        h(MessageActions.Edit, null, () => "✎"),
        h(MessageActions.Versions, null, () => [
          h(MessageActions.VersionPrevious, null, () => "‹"),
          h(MessageActions.VersionStatus),
        ]),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
