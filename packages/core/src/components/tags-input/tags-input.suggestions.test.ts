// Tags Input Suggestions in Node (tags-input "Suggestions"): the machine over a collection,
// with the harness recomputing the listed suggestions like the adapter does.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { patternResults } from "../combobox/pattern/pattern"
import { tagsInputIds } from "./tags-input.connect"
import { type TagsInputProps, tagSuggestions, tagsInputMachine } from "./tags-input.machine"
import { tagsInputMessages } from "./tags-input.messages"

const items = createListCollection({
  items: [
    ...["Partner", "Party", "Apple", "Apricot"].map((label) => ({
      id: label.toLowerCase(),
      label,
    })),
    // A mixed-case key: a lowercasing `normalize` must not change it.
    { id: "NewYork", label: "New York" },
  ],
  getKey: (r) => r.id,
  getText: (r) => r.label,
})
const announce = vi.fn()
const env = {
  scheduler: { setTimeout: () => 0, clearTimeout: () => {} },
  dom: { getRootNode: () => undefined, getById: () => null, activeElement: () => null },
  clock: { now: () => 0 },
  layout: { pageTarget: () => null },
  locale: { locale: () => "en", dir: () => "ltr" },
  platform: platforms.linux,
  announcer: { announce, prepare: () => () => {}, cancel: () => {} },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function make(over: Partial<TagsInputProps> = {}) {
  const onValueChange = vi.fn()
  const onRefuse = vi.fn()
  let current = {
    items,
    collection: items,
    ids: tagsInputIds("t"),
    strategy: "active-descendant",
    root: "t",
    locale: "en",
    messages: tagsInputMessages,
    onValueChange,
    onRefuse,
    ...over,
  } as TagsInputProps
  const s = createService(tagsInputMachine, current as never, env as never)
  s.start()
  // The adapter's derivation: the draft's results, without the chosen options.
  const sync = () => {
    const v = s.view().values
    const listed = tagSuggestions(
      patternResults(items, v.inputValue as string, undefined, "en"),
      v.value as readonly string[],
      current.allowDuplicates === true,
    )
    if ([...listed].map((n) => n.key).join() === [...current.collection].map((n) => n.key).join())
      return
    current = { ...current, collection: listed }
    s.setProps(current as never)
  }
  const send = (e: Parameters<typeof s.send>[0]) => {
    s.send(e)
    sync()
  }
  const type = (text: string) =>
    send({
      type: "INPUT.CHANGE",
      text,
      inputType: "insertText",
      composing: false,
      caretAtEnd: true,
    })
  return {
    s,
    send,
    type,
    onValueChange,
    onRefuse,
    tags: () => s.view().values.value as readonly string[],
    draft: () => s.view().values.inputValue as string,
    state: () => s.getSnapshot().state,
    listed: () => [...current.collection].map((n) => String(n.key)),
    focus: () => send({ type: "INPUT.FOCUS", modality: "keyboard" }),
    down: () => send({ type: "ARROW", key: "NEXT", alt: false, composing: false }),
    enter: () => send({ type: "ENTER", composing: false }),
    choose: (key: string) => send({ type: "ITEM.CHOOSE", key: toKey(key), modality: "pointer" }),
  }
}

describe("Tags Input suggestions", () => {
  it("one commit per action: paste text, Enter, remove, choose (zag#1661, ark#2742)", () => {
    const m = make()
    m.focus()
    // A plain paste (no delimiter) is the browser's insertion: a text change.
    m.type("part")
    expect(m.state()).toBe("suggesting")
    m.enter()
    expect(m.tags()).toEqual(["part"])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    m.send({ type: "CHIP.REMOVE", key: "part" })
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
    m.type("part")
    m.choose("partner")
    expect(m.onValueChange).toHaveBeenCalledTimes(3)
    expect(m.tags()).toEqual(["partner"])
  })

  it("Enter on the highlight creates a tag from the key; the draft clears, the popup stays", () => {
    const m = make()
    m.focus()
    m.type("ap")
    m.down()
    m.enter()
    expect(m.tags()).toEqual(["apple"])
    expect(m.draft()).toBe("")
    expect(m.state()).toBe("suggesting")
    // The chosen option is hidden; its text names the announcement.
    expect(m.listed()).not.toContain("apple")
    expect(announce).toHaveBeenCalledWith(expect.objectContaining({ message: "Apple added" }))
  })

  it("a chosen option's key is the tag, never normalised", () => {
    const m = make({ normalize: (t) => t.trim().toLowerCase() })
    m.focus()
    m.down()
    m.choose("NewYork")
    expect(m.tags()).toEqual(["NewYork"])
  })

  it("closeOnSelect closes after a choice", () => {
    const m = make({ closeOnSelect: true })
    m.focus()
    m.type("ap")
    m.choose("apricot")
    expect([m.tags(), m.state()]).toEqual([["apricot"], "typing"])
  })

  it("allowDuplicates keeps chosen options listed", () => {
    const m = make({ allowDuplicates: true })
    m.focus()
    m.down()
    m.choose("apple")
    expect(m.listed()).toContain("apple")
  })

  it("allowCustom false refuses free text with reason invalid", () => {
    const m = make({ allowCustom: false })
    m.focus()
    m.type("zzz")
    m.enter()
    expect(m.tags()).toEqual([])
    expect(m.onRefuse).toHaveBeenCalledWith({ reason: "invalid", text: "zzz" })
    m.type("pa")
    m.choose("party")
    expect(m.tags()).toEqual(["party"])
  })

  it("a ChipRemove press keeps the popup open and the draft (reka-ui#1579)", () => {
    const m = make({ defaultValue: ["apple"] })
    m.focus()
    m.type("pa")
    m.send({ type: "CHIP.REMOVE", key: "apple" })
    expect([m.tags(), m.draft(), m.state()]).toEqual([[], "pa", "suggesting"])
  })

  it("choosing with blurBehavior add creates only the chosen tag (reka-ui#2259)", () => {
    const m = make({ blurBehavior: "add" })
    m.focus()
    m.type("a")
    m.choose("apple")
    m.send({ type: "FOCUS.LEAVE" })
    expect(m.tags()).toEqual(["apple"])
  })

  it("Escape closes; without items nothing opens", () => {
    const m = make()
    m.focus()
    m.down()
    expect(m.state()).toBe("suggesting")
    m.send({ type: "ESCAPE", composing: false })
    expect(m.state()).toBe("typing")
    const n = make({ items: undefined })
    n.focus()
    n.type("pa")
    n.down()
    expect(n.state()).toBe("typing")
  })
})
