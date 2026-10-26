// JSON Tree View's Vue parts: the default tree from `data` alone, names and the JSON queries,
// lazy materialisation, expansion kept across new data, copy formats and failure, expandAll,
// and markup parity with React (server and client).
import * as R from "@rind-ui/react"
import { fakeClipboard, getJsonTreeView, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { JsonTreeView, type JsonTreeViewApi, RindProvider, TreeView } from "../index"

/** Lets effects and promise callbacks run (no elapsed time). */
const settle = async () => {
  await Promise.resolve()
  await nextTick()
}
const DATA = {
  name: "Ada",
  age: 36,
  tags: ["math", "poetry"],
  address: { city: "London", zip: null },
  big: 12345678901234567890n,
}

function setup(root: Record<string, unknown> = {}, data: unknown = DATA, custom = false) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  let api: JsonTreeViewApi | undefined
  const m = mount(
    (p: { data: unknown }) =>
      h(RindProvider, { announcer: rec.announcer, environment: { clipboard } }, () =>
        h(
          JsonTreeView.Root,
          { data: p.data, "aria-label": "Response", ...root },
          custom
            ? {
                default: (a: JsonTreeViewApi) => {
                  api = a
                  return h(
                    TreeView.Tree,
                    { "aria-label": "Response" },
                    {
                      default: (n: { key: string }) =>
                        h(JsonTreeView.Item, { value: n.key }, () =>
                          h(TreeView.ItemText, null, () => [
                            h(JsonTreeView.Key),
                            h(JsonTreeView.Separator, null, () => " = "),
                            h(JsonTreeView.Value),
                            h(JsonTreeView.SummaryText),
                          ]),
                        ),
                    },
                  )
                },
              }
            : undefined,
        ),
      ),
    { data },
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const items = () => [...m.host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
  const item = (pointer: string) => q(`[role="treeitem"][data-key="${pointer}"]`)
  return {
    ...m,
    rec,
    clipboard,
    q,
    items,
    item,
    api: () => api,
    d: () => getJsonTreeView(document.body, { name: "Response" }),
  }
}

describe("Vue JsonTreeView", () => {
  it("renders the whole tree from data alone, named by its visible text", async () => {
    const t = setup()
    await settle()
    expect(t.q('[role="tree"]').getAttribute("aria-label")).toBe("Response")
    // Depth 1: the roots' containers open, their children closed.
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
    expect(t.item("/tags").getAttribute("aria-expanded")).toBe("true")
    expect(t.item("/name").dataset["type"]).toBe("string")
    const d = t.d()
    expect(await d.valueText("/big")).toBe("12345678901234567890")
    expect(await d.summaryOf("/tags")).toBe("array, 2 entries")
    expect(await d.nodeAt("/name")).toBe("name: Ada")
    expect(await d.nodeAt("/tags")).toBe("tags: array, 2 entries")
    expect(t.q('[data-key="/address"] [data-part="preview"]')).toBeNull()
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
    const t = setup({ defaultExpandedDepth: 0 })
    await settle()
    expect(t.item("/address/city")).toBeNull()
    expect(t.q('[data-key="/address"] [data-part="preview"]').textContent).toBe("city, zip")
    const d = t.d()
    await d.expand("address: object, 2 entries")
    expect(t.item("/address/city")).not.toBeNull()
    await t.rerender({ data: { ...DATA, address: { city: "Paris", zip: "75001" } } })
    await settle()
    expect(t.item("/address").getAttribute("aria-expanded")).toBe("true")
    expect(await d.valueText("/address/city")).toBe("Paris")
  })

  it("groups a 100k array lazily: fewer than 200 items exist", async () => {
    const t = setup({}, { list: Array.from({ length: 100_000 }, (_, i) => i) })
    await settle()
    await t.d().expand("list: array, 100000 entries")
    expect(t.items().length).toBeLessThan(200)
    expect(t.items().some((i) => i.dataset["range"] !== undefined)).toBe(true)
  })

  for (const [format, pointer, expected] of [
    ["json", "/tags", '[\n  "math",\n  "poetry"\n]'],
    ["value", "/name", "Ada"],
    ["pointer", "/tags", "/tags"],
  ] as const) {
    it(`copies the focused item as ${format} (${pointer})`, async () => {
      const t = setup({ copyFormat: format })
      await settle()
      t.item(pointer).focus()
      await t.d().via("keyboard").copy()
      await settle()
      expect(t.clipboard.copied).toEqual([expected])
      expect(await t.d().copyState()).toBe("copied")
      expect(t.rec.log.map((a) => a.message)).toEqual(["Copied"])
    })
  }

  it("reports a failed copy of a cycle", async () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic["self"] = { back: cyclic }
    const c = setup({}, { root: cyclic })
    await settle()
    c.item("/root").focus()
    await c.d().via("keyboard").copy()
    await settle()
    expect(await c.d().copyState()).toBe("error")
    expect(c.rec.log.map((a) => a.message)).toEqual(["Copy failed"])
  })

  it("custom markup: Tree View parts with the JSON parts; expandAll to a depth", async () => {
    const t = setup({}, DATA, true)
    await settle()
    expect(t.item("/name").textContent).toBe("name = Ada")
    expect(t.item("/tags").textContent).toContain("array, 2 entries")
    t.api()?.expandAll({ depth: 2 })
    await settle()
    expect(t.item("/address").getAttribute("aria-expanded")).toBe("true")
  })

  it("matches React's markup, server and client", async () => {
    const data = { name: "Ada", tags: ["a", "b"], nested: { x: 1 } }
    const react = r(R.JsonTreeView.Root, { data, "aria-label": "Response" })
    const vue = () => h(JsonTreeView.Root, { data, "aria-label": "Response" })
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
