import { describe, expect, it } from "vitest"
import type { Modality } from "../contract/env"
import { type CollectionKey, toKey } from "./key"
import { type Collection, createListCollection } from "./list"
import {
  type Anchor,
  clearSelection,
  deselect,
  emptySelection,
  isSelected,
  rememberTexts,
  type SelectionConfig,
  type SelectionValue,
  select,
  selectedKeys,
  toggleSelectAll,
} from "./selection"

interface Row {
  id: string
  disabled?: boolean
}

const list = (ids: string, disabled: string[] = []): Collection<Row> =>
  createListCollection<Row>({
    items: ids.split("").map((id) => ({ id, disabled: disabled.includes(id) })),
    getKey: (r) => r.id,
    getText: (r) => r.id.toUpperCase(),
    isDisabled: (r) => r.disabled === true,
  })

const cfg = (over: Partial<SelectionConfig> = {}): SelectionConfig => ({
  mode: "multiple",
  behavior: "toggle",
  disallowEmpty: false,
  disabledBehavior: "all",
  ...over,
})

const set = (...k: string[]): SelectionValue => new Set(k.map(toKey))
const sorted = (s: SelectionValue, c: Collection<unknown>) => selectedKeys(c, s).sort()

interface Press {
  key: string
  shift?: boolean
  mod?: boolean
  modality?: Modality
}

/** Runs presses in order, threading the anchor like the machine does. */
function run(
  c: Collection<unknown>,
  config: SelectionConfig,
  presses: Press[],
  start: SelectionValue = emptySelection,
) {
  let value = start
  let anchor: Anchor | null = null
  for (const p of presses) {
    const r = select(
      c,
      value,
      anchor,
      {
        key: toKey(p.key),
        modality: p.modality ?? "pointer",
        shift: p.shift === true,
        mod: p.mod === true,
      },
      config,
    )
    value = r.value
    anchor = r.anchor
  }
  return { value, anchor }
}

describe("selection", () => {
  const c = list("abcdef")

  it("Single replaces", () => {
    const r = run(c, cfg({ mode: "single" }), [{ key: "b" }], set("a"))
    expect(sorted(r.value, c)).toEqual(["b"])
  })

  it("single toggle press on the selected item clears it, unless empty is disallowed", () => {
    expect(sorted(run(c, cfg({ mode: "single" }), [{ key: "a" }], set("a")).value, c)).toEqual([])
    expect(
      sorted(
        run(c, cfg({ mode: "single", disallowEmpty: true }), [{ key: "a" }], set("a")).value,
        c,
      ),
    ).toEqual(["a"])
  })

  it("mode none changes nothing", () => {
    const r = run(c, cfg({ mode: "none" }), [{ key: "a" }], set("b"))
    expect(sorted(r.value, c)).toEqual(["b"])
    expect(toggleSelectAll(c, set("b"), cfg({ mode: "none" }))).toEqual(set("b"))
    expect(clearSelection(set("b"), cfg({ mode: "none" }))).toEqual(set("b"))
  })

  it("Replace behaviour with modifier", () => {
    const r = run(c, cfg({ behavior: "replace" }), [{ key: "a" }, { key: "c", mod: true }])
    expect(sorted(r.value, c)).toEqual(["a", "c"])
  })

  it("replace press without modifier replaces", () => {
    const r = run(c, cfg({ behavior: "replace" }), [{ key: "a" }, { key: "c" }])
    expect(sorted(r.value, c)).toEqual(["c"])
  })

  it("Empty selection disallowed", () => {
    const config = cfg({ disallowEmpty: true })
    expect(sorted(run(c, config, [{ key: "a" }], set("a")).value, c)).toEqual(["a"])
    expect(clearSelection(set("a"), config)).toEqual(set("a"))
    expect(clearSelection(set("a"), cfg())).toEqual(emptySelection)
  })

  it("VoiceOver selects a second item (touch and virtual toggle)", () => {
    for (const modality of ["virtual", "touch"] as const) {
      const r = run(c, cfg({ behavior: "replace" }), [{ key: "b", modality }], set("a"))
      expect(sorted(r.value, c)).toEqual(["a", "b"])
    }
  })

  it("Controlled selection keeps ranges working (anchor passed back in)", () => {
    const config = cfg({ behavior: "replace" })
    const first = select(c, emptySelection, null, press("b"), config)
    // The parent hands back a brand new set on every change.
    const controlled = new Set(first.value as ReadonlySet<CollectionKey>)
    const second = select(c, controlled, first.anchor, press("e", { shift: true }), config)
    expect(sorted(second.value, c)).toEqual(["b", "c", "d", "e"])
  })

  it("Range shrinks", () => {
    const r = run(c, cfg({ behavior: "replace" }), [
      { key: "b" },
      { key: "e", shift: true },
      { key: "c", shift: true },
    ])
    expect(sorted(r.value, c)).toEqual(["b", "c"])
  })

  it("Hover does not move the anchor", () => {
    const r = run(c, cfg({ behavior: "replace" }), [{ key: "b" }, { key: "c", shift: true }])
    expect(r.anchor?.key).toBe("b")
    expect(sorted(r.value, c)).toEqual(["b", "c"])
  })

  it("range keeps selections made before it", () => {
    const r = run(c, cfg({ behavior: "toggle" }), [
      { key: "a" },
      { key: "c" },
      { key: "e", shift: true },
    ])
    expect(sorted(r.value, c)).toEqual(["a", "c", "d", "e"])
  })

  it("One result for a range of five", () => {
    const first = select(c, emptySelection, null, press("a"), cfg())
    const r = select(c, first.value, first.anchor, press("e", { shift: true }), cfg())
    expect(selectedKeys(c, r.value)).toHaveLength(5)
    expect(r.anchor).toEqual({ key: "a", rangeEnd: "e" })
  })

  it("Range across a disabled item", () => {
    const d = list("abcde", ["c"])
    const r = run(d, cfg(), [{ key: "b" }, { key: "d", shift: true }])
    expect(sorted(r.value, d)).toEqual(["b", "d"])
  })

  it("Disabled never selected", () => {
    const d = list("abc", ["b"])
    const r = select(d, set("a"), null, press("b"), cfg())
    expect(r.value).toEqual(set("a"))
    expect(select(d, set("a"), null, press("b"), cfg({ mode: "single" })).value).toEqual(set("a"))
    expect(
      sorted(toggleSelectAll(d, emptySelection, cfg()) as "all" | Set<never> as never, d),
    ).toEqual(["a", "c"])
    expect(isSelected(d, "all", toKey("b"))).toBe(false)
  })

  it("a controlled value containing a disabled key is kept as given", () => {
    const d = list("abc", ["b"])
    expect(isSelected(d, set("b"), toKey("b"))).toBe(true)
  })

  it("unknown key changes nothing", () => {
    expect(select(c, set("a"), null, press("zzz"), cfg()).value).toEqual(set("a"))
  })

  it("Select all with unloaded pages: includes items loaded later", () => {
    const all = toggleSelectAll(list("abc"), emptySelection, cfg())
    expect(all).toBe("all")
    const later = list("abcdef")
    expect(isSelected(later, all, toKey("f"))).toBe(true)
    expect(selectedKeys(later, all)).toHaveLength(6)
  })

  it("select all toggles off when everything is selected, unless empty is disallowed", () => {
    const cc = list("abc")
    expect(toggleSelectAll(cc, "all", cfg())).toEqual(emptySelection)
    expect(toggleSelectAll(cc, set("a", "b", "c"), cfg())).toEqual(emptySelection)
    expect(toggleSelectAll(cc, "all", cfg({ disallowEmpty: true }))).toBe("all")
    expect(toggleSelectAll(cc, set("a"), cfg())).toBe("all")
    expect(toggleSelectAll(cc, "all", cfg({ mode: "single" }))).toBe("all")
  })

  it("Shift from a select-all state replaces it with the range", () => {
    const r = select(
      c,
      "all",
      { key: toKey("b"), rangeEnd: null },
      press("d", { shift: true }),
      cfg({ behavior: "replace" }),
    )
    expect(sorted(r.value, c)).toEqual(["b", "c", "d"])
  })

  it("pressing an item under select all deselects just that item", () => {
    const r = select(c, "all", null, press("b"), cfg())
    expect(sorted(r.value, c)).toEqual(["a", "c", "d", "e", "f"])
  })

  it("deselect is explicit and ignores disallowEmpty", () => {
    expect(deselect(c, set("a", "b"), toKey("a"))).toEqual(set("b"))
    expect(deselect(c, set("a"), toKey("a"))).toEqual(emptySelection)
    const same = set("a")
    expect(deselect(c, same, toKey("b"))).toBe(same)
  })

  it("rememberTexts keeps labels of filtered-out keys", () => {
    const full = list("abc")
    let texts = rememberTexts(new Map(), full, set("a", "b"))
    expect(texts.get(toKey("a"))).toBe("A")
    const filtered = full.filter((n) => n.key === "c")
    texts = rememberTexts(texts, filtered, set("a", "b"))
    expect(texts.get(toKey("a"))).toBe("A")
    expect(texts.get(toKey("b"))).toBe("B")
    const same = rememberTexts(texts, full, set("a", "b"))
    expect(same).toBe(texts)
    expect(rememberTexts(texts, full, "all")).toBe(texts)
  })
})

function press(key: string, extra: { shift?: boolean; mod?: boolean } = {}) {
  return {
    key: toKey(key),
    modality: "pointer" as const,
    shift: extra.shift === true,
    mod: extra.mod === true,
  }
}
