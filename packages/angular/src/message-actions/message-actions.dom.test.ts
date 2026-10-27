// Message Actions' Angular parts: one Toolbar Tab stop, shown by the message's hover and focus,
// copy, regenerate busy until it settles, edit's pressed state and focus back, single
// deselectable feedback, versions.
import { Component, input } from "@angular/core"
import { fakeClipboard, getMessageActions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { MessageActions } from "./message-actions"

/** The fixture's configuration and environment, for the next mount. */
let current: {
  provider: { announcer: unknown; environment: unknown }
  regenerate: () => Promise<void>
} = { provider: { announcer: null, environment: {} }, regenerate: async () => {} }

@Component({
  selector: "rind-f",
  imports: [RindProvider, MessageActions],
  template: `<ng-container
    rindProvider
    [announcer]="$any(cfg.provider.announcer)"
    [environment]="$any(cfg.provider.environment)"
  >
    <article data-testid="message">
      <p>{{ text() }}</p>
      <div rindMessageActionsRoot [count]="count()" [onRegenerate]="cfg.regenerate">
        <span rindMessageActionsCopy [value]="text">⧉</span>
        <button rindMessageActionsRegenerate>↻</button>
        <button rindMessageActionsEdit>✎</button>
        <div rindMessageActionsFeedback>
          <button rindMessageActionsFeedbackItem value="up">👍</button>
          <button rindMessageActionsFeedbackItem value="down">👎</button>
        </div>
        <div rindMessageActionsVersions>
          <button rindMessageActionsVersionPrevious>‹</button>
          <span rindMessageActionsVersionStatus></span>
          <button rindMessageActionsVersionNext>›</button>
        </div>
      </div>
    </article>
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly text = input("Hello")
  readonly count = input(0)
}

async function setup(p: { text?: string; count?: number } = {}) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  const regenerated: number[] = []
  let finish: (() => void) | undefined
  current = {
    provider: { announcer: rec.announcer, environment: { clipboard } },
    regenerate: () => {
      regenerated.push(1)
      return new Promise<void>((r) => {
        finish = r
      })
    },
  }
  const m = await mount(Tree, { text: p.text ?? "Hello", count: p.count ?? 0 })
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return {
    ...m,
    rec,
    clipboard,
    regenerated,
    finish: () => finish?.(),
    q,
    stable: () => m.rerender({}),
    d: () => getMessageActions(document.body, { name: "Message actions" }),
  }
}

describe("Angular MessageActions", () => {
  it("is one named toolbar, one Tab stop, with named controls", async () => {
    const t = await setup({ count: 3 })
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
    expect(t.q('[data-part="version-status"]').textContent?.trim()).toBe("1 / 3")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("shows the row on the message's hover and focus", async () => {
    const t = await setup()
    const d = t.d()
    expect(await d.isActive()).toBe(false)
    t.q('[data-testid="message"]').dispatchEvent(new PointerEvent("pointerenter"))
    await t.stable()
    expect(await d.isActive()).toBe(true)
    t.q('[data-testid="message"]').dispatchEvent(new PointerEvent("pointerleave"))
    await t.stable()
    expect(await d.isActive()).toBe(false)
  })

  it("copies the current text", async () => {
    const t = await setup()
    await t.rerender({ text: "Hello, edited" })
    await t.d().via("pointer").copy()
    await vi.waitFor(() => expect(t.clipboard.copied).toEqual(["Hello, edited"]))
  })

  it("keeps Regenerate busy until its promise settles", async () => {
    const t = await setup()
    const d = t.d()
    await d.via("keyboard").regenerate()
    await t.stable()
    expect(t.regenerated).toEqual([1])
    expect(await d.regenerateState()).toBe("pending")
    const button = t.q('[data-part="regenerate"]')
    expect(button.getAttribute("aria-disabled")).toBe("true")
    button.click()
    expect(t.regenerated).toEqual([1])
    t.finish()
    await vi.waitFor(async () => {
      await t.stable()
      expect(await d.regenerateState()).toBe("done")
    })
  })

  it("toggles editing and brings the focus back to Edit", async () => {
    const t = await setup()
    const d = t.d()
    const edit = t.q('[data-part="edit"]')
    await d.via("pointer").edit()
    await t.stable()
    expect(await d.isEditing()).toBe(true)
    expect(edit.getAttribute("aria-pressed")).toBe("true")
    ;(document.activeElement as HTMLElement | null)?.blur()
    await d.via("pointer").edit()
    await t.stable()
    expect(await d.isEditing()).toBe(false)
    expect(document.activeElement).toBe(edit)
  })

  it("rates with a single, deselectable choice", async () => {
    const t = await setup()
    const d = t.d()
    await d.via("pointer").rate("up")
    await t.stable()
    expect(await d.rating()).toBe("up")
    await d.via("pointer").rate("down")
    await t.stable()
    expect(await d.rating()).toBe("down")
    await d.via("pointer").rate("down")
    await t.stable()
    expect(await d.rating()).toBe(null)
  })

  it("moves between versions and announces them; none below two", async () => {
    const t = await setup({ count: 2 })
    const d = t.d()
    expect(t.q('[data-part="version-previous"]').getAttribute("aria-disabled")).toBe("true")
    await d.via("pointer").nextVersion()
    await t.stable()
    expect(await d.version()).toEqual({ index: 1, count: 2 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Version 2 of 2"])
    await t.rerender({ count: 1 })
    expect(t.q('[data-part="versions"]').hasAttribute("hidden")).toBe(true)
  })
})
