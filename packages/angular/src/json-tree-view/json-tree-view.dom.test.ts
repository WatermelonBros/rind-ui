// JSON Tree View's Angular parts: the default tree from `data` alone, names and the JSON queries,
// lazy materialisation, expansion kept across new data, copy formats and failure, custom markup
// and expandAll.
import { Component, input } from "@angular/core"
import { fakeClipboard, getJsonTreeView, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { TreeView } from "../tree-view/tree-view"
import { JsonTreeView, type JsonTreeViewRoot } from "./json-tree-view"

const DATA = {
  name: "Ada",
  age: 36,
  tags: ["math", "poetry"],
  address: { city: "London", zip: null },
  big: 12345678901234567890n,
}

/** The fixture's configuration, for the next mount. */
let current: {
  depth: number
  format: "json" | "value" | "pointer"
  custom: boolean
  provider: { announcer: unknown; environment: unknown }
} = { depth: 1, format: "json", custom: false, provider: { announcer: null, environment: {} } }

@Component({
  selector: "rind-f",
  imports: [RindProvider, JsonTreeView, TreeView],
  template: `<ng-container
    rindProvider
    [announcer]="$any(cfg.provider.announcer)"
    [environment]="$any(cfg.provider.environment)"
  >
    @if (cfg.custom) {
      <div rindJsonTreeViewRoot #root="rindJsonTreeViewRoot" [data]="data()" [defaultExpandedDepth]="cfg.depth">
        <ng-template rindJsonTreeViewContent>
          <div rindTreeViewTree aria-label="Response">
            <ng-template rindTreeViewRow let-node>
              <div rindJsonTreeViewItem [value]="node.key">
                <span rindTreeViewItemText
                  ><span rindJsonTreeViewKey></span><span rindJsonTreeViewSeparator> = </span
                  ><span rindJsonTreeViewValue></span><span rindJsonTreeViewSummaryText></span
                ></span>
              </div>
            </ng-template>
          </div>
          <button rindJsonTreeViewCopyTrigger></button>
        </ng-template>
      </div>
    } @else {
      <div
        rindJsonTreeViewRoot
        [data]="data()"
        aria-label="Response"
        [defaultExpandedDepth]="cfg.depth"
        [copyFormat]="cfg.format"
      ></div>
    }
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly data = input<unknown>(DATA)
}

async function setup(
  p: { depth?: number; format?: "json" | "value" | "pointer"; custom?: boolean } = {},
  data: unknown = DATA,
) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  current = {
    depth: p.depth ?? 1,
    format: p.format ?? "json",
    custom: p.custom ?? false,
    provider: { announcer: rec.announcer, environment: { clipboard } },
  }
  const m = await mount(Tree, { data })
  const stable = () => m.rerender({})
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const items = () => [...m.host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
  const item = (pointer: string) => q(`[role="treeitem"][data-key="${pointer}"]`)
  const root = () =>
    (m.ref.instance as unknown as { root?: JsonTreeViewRoot }).root ??
    (null as unknown as JsonTreeViewRoot)
  return {
    ...m,
    rec,
    clipboard,
    stable,
    q,
    items,
    item,
    root,
    d: () => getJsonTreeView(document.body, { name: "Response" }),
  }
}

describe("Angular JsonTreeView", () => {
  it("renders the whole tree from data alone, named by its visible text", async () => {
    const t = await setup()
    expect(t.q('[role="tree"]').getAttribute("aria-label")).toBe("Response")
    expect(t.items().map((i) => i.dataset["key"])).toEqual([
      "/name",
      "/age",
      "/tags",
      "/tags/0",
      "/tags/1",
      "/address",
      "/address/city",
      "/address/zip",
      "/big",
    ])
    expect(t.item("/name").hasAttribute("aria-expanded")).toBe(false)
    expect(t.item("/name").dataset["type"]).toBe("string")
    const d = t.d()
    expect(await d.valueText("/name")).toBe("Ada")
    expect(await d.valueText("/big")).toBe("12345678901234567890")
    expect(await d.summaryOf("/tags")).toBe("array, 2 entries")
    expect(await d.nodeAt("/name")).toBe("name: Ada")
    expect(await d.nodeAt("/tags")).toBe("tags: array, 2 entries")
    const { violations } = await axe.run(t.host, {
      rules: {
        region: { enabled: false },
        "color-contrast": { enabled: false },
        // The container's glyph ("[2]") is aria-hidden and spoken as "array, 2 entries" by
        // design (spec §5): the visible key starts the name, which is what 2.5.3 asks.
        "label-content-name-mismatch": { enabled: false },
      },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("builds children only when expanded, and keeps the expansion for new data", async () => {
    const t = await setup({ depth: 0 })
    expect(t.item("/address/city")).toBeNull()
    expect(t.q('[data-key="/address"] [data-part="preview"]').textContent).toBe("city, zip")
    const d = t.d()
    await d.expand("address: object, 2 entries")
    await t.stable()
    expect(await d.valueText("/address/zip")).toBe("null")
    await t.rerender({ data: { ...DATA, address: { city: "Paris", zip: "75001" } } })
    expect(t.item("/address").getAttribute("aria-expanded")).toBe("true")
    expect(await d.valueText("/address/city")).toBe("Paris")
  })

  it("groups a 100k array lazily: fewer than 200 items exist", async () => {
    const t = await setup({ depth: 0 }, { list: Array.from({ length: 100_000 }, (_, i) => i) })
    await t.d().expand("list: array, 100000 entries")
    await t.stable()
    expect(t.items().length).toBeLessThan(200)
    expect(t.items().some((i) => i.dataset["range"] !== undefined)).toBe(true)
  })

  for (const [format, pointer, expected] of [
    ["json", "/tags", '[\n  "math",\n  "poetry"\n]'],
    ["value", "/name", "Ada"],
    ["pointer", "/tags", "/tags"],
  ] as const) {
    it(`copies the focused item as ${format} (${pointer})`, async () => {
      const t = await setup({ format })
      t.item(pointer).focus()
      await t.d().via("keyboard").copy()
      await t.stable()
      expect(t.clipboard.copied).toEqual([expected])
      expect(await t.d().copyState()).toBe("copied")
      expect(t.rec.log.map((a) => a.message)).toEqual(["Copied"])
    })
  }

  it("reports a failed copy of a cycle", async () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic["self"] = { back: cyclic }
    const t = await setup({}, { root: cyclic })
    t.item("/root").focus()
    await t.d().via("keyboard").copy()
    await t.stable()
    expect(await t.d().copyState()).toBe("error")
    expect(t.rec.log.map((a) => a.message)).toEqual(["Copy failed"])
  })

  it("custom markup: Tree View parts with the JSON parts; the CopyTrigger", async () => {
    const t = await setup({ custom: true, format: "json" })
    expect(t.item("/name").textContent?.replace(/\s+/g, " ").trim()).toBe("name = Ada")
    expect(t.item("/tags").textContent).toContain("array, 2 entries")
    const trigger = t.q('[data-part="copy-trigger"]')
    expect(trigger.textContent?.trim()).toBe("Copy")
    t.item("/age").focus()
    trigger.click()
    await t.stable()
    expect(t.clipboard.copied).toEqual(["36"])
  })
})
