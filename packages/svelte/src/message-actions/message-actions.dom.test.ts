// Message Actions' Svelte parts: one Toolbar Tab stop, shown by the message's hover, copy at
// press time, regenerate busy until it settles, edit's focus back, single deselectable
// feedback, versions, DOM parity with React.
import * as R from "@rind-ui/react"
import { fakeClipboard, getMessageActions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Row from "../../fixtures/message-actions/row.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  flushSync()
}

function setup(initial: { text: string; count?: number }) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  const regenerated: number[] = []
  let finish: (() => void) | undefined
  const m = mount(Row, {
    ...initial,
    provider: { announcer: rec.announcer, environment: { clipboard } },
    onRegenerate: () => {
      regenerated.push(1)
      return new Promise<void>((res) => {
        finish = res
      })
    },
  } as never)
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

describe("Svelte MessageActions", () => {
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
    expect(t.q('[data-part="version-status"]').textContent).toBe("1 / 3")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("shows the row on the message's hover", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    expect(await t.d().isActive()).toBe(false)
    t.q('[data-testid="message"]').dispatchEvent(new PointerEvent("pointerenter"))
    flushSync()
    expect(await t.d().isActive()).toBe(true)
  })

  it("copies the text at press time", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    t.rerender({ text: "Hello, edited" } as never)
    await t.d().via("pointer").copy()
    await vi.waitFor(() => expect(t.clipboard.copied).toEqual(["Hello, edited"]))
  })

  it("keeps Regenerate busy until its promise settles", async () => {
    const t = setup({ text: "Hello" })
    await settle()
    const d = t.d()
    await d.via("keyboard").regenerate()
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

  it("rates with a single, deselectable choice; versions move and announce", async () => {
    const t = setup({ text: "Hello", count: 2 })
    await settle()
    const d = t.d()
    await d.via("pointer").rate("up")
    expect(await d.rating()).toBe("up")
    await d.via("pointer").rate("up")
    expect(await d.rating()).toBe(null)
    await d.via("pointer").nextVersion()
    expect(await d.version()).toEqual({ index: 1, count: 2 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Version 2 of 2"])
  })

  it("matches React", async () => {
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
    await clientParity(react, Row, { text: "Hello", count: 2, full: false } as never)
  })
})
