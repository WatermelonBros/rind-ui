// The Tags Input machine in Node (task 1.7): creation paths, delimiters, IME, paste,
// refusal, max, duplicates, keys, editing, blur behaviour, chips. No DOM.
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import { tagsInputIds } from "./tags-input.connect"
import { type TagsInputProps, tagKeys, tagsInputMachine } from "./tags-input.machine"
import { tagsInputMessages } from "./tags-input.messages"

const announce = vi.fn()
const env = { announcer: { announce, prepare: () => () => {}, cancel: () => {} } }

function make(over: Partial<TagsInputProps> = {}) {
  const onValueChange = vi.fn()
  const onRefuse = vi.fn()
  const props: TagsInputProps = {
    collection: createListCollection<string>({ items: [], getKey: String, getText: String }),
    ids: tagsInputIds("t"),
    strategy: "active-descendant",
    root: "t",
    locale: "en",
    messages: tagsInputMessages,
    onValueChange,
    onRefuse,
    ...over,
  }
  const s = createService(tagsInputMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  const type = (text: string, o: { composing?: boolean; caretAtEnd?: boolean } = {}) =>
    send({
      type: "INPUT.CHANGE",
      text,
      inputType: "insertText",
      composing: o.composing ?? false,
      caretAtEnd: o.caretAtEnd ?? true,
    })
  return {
    s,
    props,
    send,
    type,
    onValueChange,
    onRefuse,
    tags: () => s.view().values.value as readonly string[],
    draft: () => s.view().values.inputValue as string,
    ctx: () => s.getSnapshot().context,
    state: () => s.getSnapshot().state,
    focus: () => send({ type: "INPUT.FOCUS", modality: "keyboard" }),
    enter: (composing = false) => send({ type: "ENTER", composing }),
    paste: (text: string) => send({ type: "PASTE", text, composing: false }),
  }
}

describe("Tags Input machine", () => {
  it("Enter creates a tag from the normalised draft and clears it; empty Enter does nothing", () => {
    const m = make()
    m.focus()
    m.type("  rome ")
    m.enter()
    expect(m.tags()).toEqual(["rome"])
    expect(m.draft()).toBe("")
    m.onValueChange.mockClear()
    m.enter()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a delimiter at the end splits; mid-text it is text; alone it creates nothing", () => {
    const m = make()
    m.focus()
    m.type("rome,")
    expect([m.tags(), m.draft()]).toEqual([["rome"], ""])
    m.type("romeparis")
    m.type("rome,paris", { caretAtEnd: false })
    expect([m.tags(), m.draft()]).toEqual([["rome"], "rome,paris"])
    const n = make()
    n.focus()
    n.type("   ,")
    expect([n.tags(), n.draft()]).toEqual([[], ""])
  })

  it("literal string delimiters", () => {
    const m = make({ delimiter: "|" })
    m.focus()
    m.type("a|b|")
    expect(m.tags()).toEqual(["a", "b"])
  })

  it("IME: nothing is created or split while composing; the commit text is split once", () => {
    const m = make({ delimiter: [/\s/, ","] })
    m.focus()
    m.send({ type: "COMPOSITION.START" })
    m.type("ni hao", { composing: true })
    m.enter(true)
    expect(m.tags()).toEqual([])
    m.send({ type: "COMPOSITION.END", text: "你好", caretAtEnd: true })
    expect([m.tags(), m.draft()]).toEqual([[], "你好"])
    m.enter()
    expect(m.tags()).toEqual(["你好"])
  })

  it("paste with a delimiter: one change, refused segments back in the draft", () => {
    const m = make({ validate: (t) => (t.includes("@") ? true : "invalid") })
    m.focus()
    m.paste("jane@x.io, bob\njohn@x.io")
    expect(m.tags()).toEqual(["jane@x.io", "john@x.io"])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.draft()).toBe("bob")
    expect(m.ctx().refusal).toEqual({ reason: "invalid", text: "bob" })
  })

  it("a plain paste is not taken over", () => {
    const m = make()
    m.focus()
    m.paste("foo")
    expect(m.tags()).toEqual([])
    const n = make({ addOnPaste: false })
    n.focus()
    n.paste("a,b")
    expect(n.tags()).toEqual([])
  })

  it("max and duplicates refuse, keep the draft, report and announce", () => {
    announce.mockClear()
    const m = make({ max: 1 })
    m.focus()
    m.type("a")
    m.enter()
    m.type("b")
    m.enter()
    expect([m.tags(), m.draft()]).toEqual([["a"], "b"])
    expect(m.onRefuse).toHaveBeenLastCalledWith({ reason: "max", text: "b" })
    const d = make()
    d.focus()
    d.type("a,a,")
    expect(d.tags()).toEqual(["a"])
    expect(d.onRefuse).toHaveBeenLastCalledWith({ reason: "duplicate", text: "a" })
    expect(announce).toHaveBeenCalledWith(expect.objectContaining({ priority: "polite" }))
  })

  it("the refusal clears when the draft changes", () => {
    const m = make({ validate: () => "nope" })
    m.focus()
    m.type("x")
    m.enter()
    expect(m.ctx().refusal?.reason).toBe("nope")
    m.type("xy")
    expect(m.ctx().refusal).toBe(null)
  })

  it("keys: the value, or with duplicates the value and its occurrence", () => {
    expect(tagKeys(["a", "b"], false)).toEqual(["a", "b"])
    expect(tagKeys(["a", "b", "a"], true)).toEqual(["a\u00000", "b\u00000", "a\u00001"])
    const m = make({ allowDuplicates: true, defaultValue: ["a", "b", "a"] })
    m.focus()
    m.send({ type: "CHIP.REMOVE", key: "a\u00000" })
    expect(m.tags()).toEqual(["b", "a"])
  })

  it("Backspace arms the last removable chip then removes it; disabled chips are skipped", () => {
    const m = make({ defaultValue: ["admin", "user"], disabledKeys: new Set(["admin"]) })
    m.focus()
    m.send({ type: "BACKSPACE_EMPTY" })
    expect(m.ctx().armedChip).toBe("user")
    m.send({ type: "BACKSPACE_EMPTY" })
    expect(m.tags()).toEqual(["admin"])
    m.send({ type: "BACKSPACE_EMPTY" })
    expect(m.ctx().armedChip).toBe(null)
    m.send({ type: "CHIP.REMOVE", key: "admin" })
    expect(m.tags()).toEqual(["admin"])
  })

  it("a caret move disarms", () => {
    const m = make({ defaultValue: ["a"] })
    m.focus()
    m.send({ type: "BACKSPACE_EMPTY" })
    m.send({ type: "CARET" })
    expect(m.ctx().armedChip).toBe(null)
  })

  it("blur: keep (default), add (refused stays), clear; leaving clears the arm", () => {
    const k = make()
    k.focus()
    k.type("x")
    k.send({ type: "FOCUS.LEAVE" })
    expect([k.tags(), k.draft(), k.state()]).toEqual([[], "x", "idle"])
    const a = make({ blurBehavior: "add", defaultValue: ["y"] })
    a.focus()
    a.send({ type: "BACKSPACE_EMPTY" })
    a.type("x")
    a.send({ type: "FOCUS.LEAVE" })
    expect([a.tags(), a.draft(), a.ctx().armedChip]).toEqual([["y", "x"], "", null])
    const c = make({ blurBehavior: "clear" })
    c.focus()
    c.type("x")
    c.send({ type: "FOCUS.LEAVE" })
    expect(c.draft()).toBe("")
  })

  it("editing: commit, cancel, empty removes, refused stays open, a self-duplicate is fine", () => {
    const m = make({ defaultValue: ["rom", "paris"] })
    m.focus()
    m.send({ type: "TAG.EDIT", key: "rom" })
    expect([m.state(), m.ctx().editText]).toEqual(["editing", "rom"])
    m.send({ type: "EDIT.CHANGE", text: "rome" })
    m.send({ type: "EDIT.COMMIT", composing: false })
    expect([m.tags(), m.state()]).toEqual([["rome", "paris"], "typing"])
    m.send({ type: "TAG.EDIT", key: "rome" })
    m.send({ type: "EDIT.CHANGE", text: "paris" })
    m.send({ type: "EDIT.COMMIT", composing: false })
    expect([m.state(), m.ctx().editRefusal?.reason]).toEqual(["editing", "duplicate"])
    m.send({ type: "EDIT.CANCEL", composing: false })
    expect([m.tags(), m.state()]).toEqual([["rome", "paris"], "typing"])
    m.send({ type: "TAG.EDIT", key: "paris" })
    m.send({ type: "EDIT.CHANGE", text: "  " })
    m.send({ type: "EDIT.COMMIT", composing: false })
    expect(m.tags()).toEqual(["rome"])
  })

  it("read-only: nothing is created, removed or edited", () => {
    const m = make({ readOnly: true, defaultValue: ["a"] })
    m.focus()
    m.type("b")
    m.enter()
    m.send({ type: "BACKSPACE_EMPTY" })
    m.send({ type: "CHIP.REMOVE", key: "a" })
    m.send({ type: "TAG.EDIT", key: "a" })
    expect([m.tags(), m.state()]).toEqual([["a"], "typing"])
  })

  it("a refused value proposal brings the draft back", () => {
    const m = make({ value: [] })
    m.focus()
    m.type("rome")
    m.enter()
    // The parent re-renders with its own (unchanged) value.
    m.s.setProps({ ...m.props })
    expect(m.tags()).toEqual([])
    expect(m.draft()).toBe("rome")
  })

  it("clear removes every removable tag and the draft in one change", () => {
    const m = make({ defaultValue: ["a", "b"], disabledKeys: new Set(["a"]) })
    m.focus()
    m.type("x")
    m.onValueChange.mockClear()
    m.send({ type: "CLEAR.PRESS" })
    expect([m.tags(), m.draft()]).toEqual([["a"], ""])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("form reset restores the default and empties the draft", () => {
    const m = make({ defaultValue: ["a"] })
    m.focus()
    m.type("b,c")
    m.send({ type: "FORM.RESET" })
    expect([m.tags(), m.draft()]).toEqual([["a"], ""])
  })

  it("a controlled value longer than max is shown and reported once with reason max", () => {
    const m = make({ max: 2, value: ["a", "b", "c"] })
    expect(m.tags()).toEqual(["a", "b", "c"])
    expect(m.onRefuse).toHaveBeenCalledTimes(1)
    expect(m.onRefuse).toHaveBeenCalledWith({ reason: "max", text: "c" })
    m.s.setProps({ ...m.props })
    m.focus()
    m.send({ type: "FOCUS.LEAVE" })
    expect(m.onRefuse).toHaveBeenCalledTimes(1)
    m.s.setProps({ ...m.props, value: ["a", "b", "c", "d"] })
    expect(m.onRefuse).toHaveBeenCalledTimes(2)
  })

  it("several tags from one action announce the count", () => {
    announce.mockClear()
    const m = make()
    m.focus()
    m.type("a,b,")
    expect(m.tags()).toEqual(["a", "b"])
    expect(announce).toHaveBeenLastCalledWith(expect.objectContaining({ message: "2 tags added" }))
  })
})
