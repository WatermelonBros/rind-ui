// Mentions' Angular parts through its driver: a textbox described by its triggers that becomes a
// combobox while its list is open; "@" filters people and inserts a mention, which the
// Highlighter paints and Backspace removes whole; Escape keeps the list closed while typing on;
// "/" runs an action (the query removed, pick emitted). In a browser: the list opens at the
// trigger character, not at the textarea's corner.
import { Component, signal } from "@angular/core"
import type { MentionRange, MentionsQuery, MentionsSelectDetails } from "@rind-ui/core"
import { getMentions } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Mentions } from "./index"

/** Placement needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

const PEOPLE = ["Alice", "Alan", "Bob"]
const COMMANDS = ["Clear", "Summarise"]

interface Cfg {
  defaultValue: string | undefined
  defaultMentions: readonly MentionRange[] | undefined
  mentions: (readonly MentionRange[])[]
  picks: MentionsSelectDetails[]
}
/** The fixture's configuration, for the next mount. */
let current: Cfg

@Component({
  selector: "rind-f",
  imports: [Mentions],
  template: `<div
    rindMentionsRoot
    [triggers]="triggers"
    [defaultValue]="cfg.defaultValue"
    [defaultMentions]="cfg.defaultMentions"
    (queryChange)="query.set($event)"
    (mentionsChange)="cfg.mentions.push($event)"
    (pick)="cfg.picks.push($event)"
  >
    <label for="msg">Message</label>
    <div rindMentionsHighlighter></div>
    <textarea rindMentionsTextarea id="msg"></textarea>
    <p rindMentionsDescription></p>
    <div rindMentionsPositioner>
      <div rindMentionsPopup>
        <div rindMentionsList>
          @for (name of list(); track name) {
            <div rindMentionsItem [value]="name.toLowerCase()">
              <span rindMentionsItemText>{{ name }}</span>
            </div>
          }
        </div>
        <div rindMentionsEmpty>No match</div>
      </div>
    </div>
  </div>`,
})
class Tree {
  readonly cfg = current
  readonly triggers = [
    { char: "@" },
    { char: "/", behavior: "action" as const, startOfInput: true },
  ]
  readonly query = signal<MentionsQuery | null>(null)
  readonly list = () => (this.query()?.trigger === "/" ? COMMANDS : PEOPLE)
}

@Component({
  selector: "rind-p",
  imports: [Mentions],
  template: `<div rindMentionsRoot [triggers]="[{ char: '@' }]">
    <textarea
      rindMentionsTextarea
      aria-label="Placed"
      style="width: 400px; height: 80px; font: 16px monospace; padding: 0; border: 0"
    ></textarea>
    <div rindMentionsPositioner>
      <div rindMentionsPopup>
        <div rindMentionsList><div rindMentionsItem value="ann">Ann</div></div>
      </div>
    </div>
  </div>`,
})
class Placed {}

async function setup(p: Partial<Pick<Cfg, "defaultValue" | "defaultMentions">> = {}) {
  current = {
    defaultValue: p.defaultValue,
    defaultMentions: p.defaultMentions,
    mentions: [],
    picks: [],
  }
  const cfg = current
  const m = await mount(Tree)
  const stable = () => m.rerender({})
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return { ...m, cfg, stable, q, d: () => getMentions(document.body, { name: "Message" }) }
}

describe("Angular Mentions", () => {
  it("a textbox described by its triggers; no combobox state while closed", async () => {
    const t = await setup()
    const box = t.q('[data-part="textarea"]') as HTMLElement
    expect(box.hasAttribute("aria-expanded")).toBe(false)
    expect(box.getAttribute("aria-describedby")).toBe(t.q('[data-part="description"]')?.id)
    expect(t.q('[data-part="description"]')?.textContent?.trim()).toBe(
      "Type @ or / to insert a mention",
    )
    expect(t.q('[data-part="highlighter"]')?.getAttribute("aria-hidden")).toBe("true")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("@ opens the people filtered by the query; Enter inserts a mention, painted", async () => {
    const t = await setup()
    const d = t.d()
    await d.type("Hi @al")
    await t.stable()
    expect(await d.isOpen()).toBe(true)
    expect(await d.trigger()).toBe("@")
    expect(await d.options()).toEqual(["Alice", "Alan"])
    expect(t.q('[data-part="textarea"]')?.getAttribute("role")).toBe("combobox")
    expect(t.q('[data-part="textarea"]')?.getAttribute("aria-expanded")).toBe("true")
    await d.via("keyboard").choose("Alan")
    await t.stable()
    expect(await d.value()).toBe("Hi @Alan ")
    expect(await d.mentions()).toEqual(["@Alan"])
    expect(t.cfg.mentions.at(-1)).toEqual([{ id: "alan", trigger: "@", start: 3, end: 8 }])
  })

  it("Backspace into a mention removes it whole", async () => {
    const t = await setup()
    const d = t.d()
    await d.type("Hi @bo")
    // A pointer reaches the list once it is placed (unplaced, the positioner takes no pointer).
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.q('[data-part="positioner"]')?.style.pointerEvents).not.toBe("none")
    })
    await d.via("pointer").choose("Bob")
    await t.stable()
    expect(await d.value()).toBe("Hi @Bob ")
    await d.backspace()
    await t.stable()
    await d.backspace()
    await t.stable()
    expect(await d.value()).toBe("Hi ")
    expect(await d.mentions()).toEqual([])
  })

  it("Escape closes the list and it stays closed while typing on", async () => {
    const t = await setup()
    const d = t.d()
    await d.type("@a")
    await t.stable()
    await d.pressEscape()
    await d.type("l")
    await t.stable()
    expect(await d.isOpen()).toBe(false)
    await d.type(" @b")
    await t.stable()
    expect(await d.isOpen()).toBe(true)
  })

  it("/ at the start runs an action: the query is removed and pick emitted", async () => {
    const t = await setup()
    const d = t.d()
    await d.type("/cl")
    await t.stable()
    expect(await d.options()).toEqual(["Clear"])
    await d.via("keyboard").choose("Clear")
    await t.stable()
    expect(t.cfg.picks).toEqual([{ trigger: "/", key: "clear", text: "Clear" }])
    expect(await d.value()).toBe("")
  })

  it("a default value with mentions is painted by the Highlighter", async () => {
    const t = await setup({
      defaultValue: "Hi @Bob ",
      defaultMentions: [{ id: "bob", trigger: "@", start: 3, end: 7 }],
    })
    expect(t.q('[data-part="mention"]')?.textContent).toBe("@Bob")
    expect(t.q('[data-part="highlighter"]')?.textContent).toContain("Hi @Bob ")
  })

  it.skipIf(jsdom)("the list opens under the trigger character", async () => {
    const m = await mount(Placed)
    const d = getMentions(document.body, { name: "Placed" })
    await d.type("xxxxxxxxxxxxxxxxxxxx @a")
    await m.rerender({})
    const textarea = document.querySelector('[aria-label="Placed"]') as HTMLElement
    const root = textarea.closest('[data-part="root"]') as HTMLElement
    await vi.waitFor(async () => {
      await m.rerender({})
      const positioner = document.querySelector(
        `[data-part="positioner"][data-instance="${root.dataset["instance"]}"]`,
      ) as HTMLElement
      const tr = textarea.getBoundingClientRect()
      const p = positioner.getBoundingClientRect()
      // 21 monospace characters in: well right of the textarea's left edge.
      expect(p.left - tr.left).toBeGreaterThan(150)
      expect(p.top).toBeGreaterThan(tr.top)
    })
  })
})
