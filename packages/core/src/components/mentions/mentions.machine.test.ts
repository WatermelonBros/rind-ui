import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type MentionsProps, mentionsMachine } from "./mentions.machine"
import { mentionsMessages } from "./mentions.messages"

const PEOPLE = ["Ada", "Alan", "Grace"]
const people = createListCollection({
  items: PEOPLE.map((label) => ({ id: label.toLowerCase(), label })),
  getKey: (r) => r.id,
  getText: (r) => r.label,
})
const env = {
  scheduler: { setTimeout: () => 0, clearTimeout: () => {} },
  dom: { getRootNode: () => undefined, getById: () => null, activeElement: () => null },
  clock: { now: () => 0 },
  layout: { pageTarget: () => null },
  locale: { locale: () => "en", dir: () => "ltr" },
  platform: platforms.linux,
  announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
  setCaret: vi.fn(),
}

function make(over: Partial<MentionsProps> = {}) {
  const onQueryChange = vi.fn()
  const onSelect = vi.fn()
  const props = {
    collection: people,
    strategy: "active-descendant",
    ids: { list: "list", item: (k: string) => `item-${k}` },
    root: "m",
    messages: mentionsMessages,
    triggers: [{ char: "@" }, { char: "/", behavior: "action" }],
    onQueryChange,
    onSelect,
    ...over,
  } as unknown as MentionsProps
  const s = createService(mentionsMachine, props as never, env as never)
  s.start()
  s.send({ type: "INPUT.FOCUS" })
  const type = (value: string, caret = value.length) =>
    s.send({ type: "INPUT", value, caret, composing: false })
  const v = () => s.view(props as never).values as { value: string; mentions: unknown[] }
  return { s, type, v, onQueryChange, onSelect, state: () => s.getSnapshot().state }
}

describe("mentions machine", () => {
  it("opens at a trigger with its query, closes when the match ends", () => {
    const t = make()
    t.type("hi @a")
    expect(t.state()).toBe("open")
    expect(t.onQueryChange).toHaveBeenLastCalledWith({ trigger: "@", query: "a" })
    expect(t.s.getSnapshot().context.highlightedKey).toBe("ada")
    t.type("hi @a ")
    expect(t.state()).toBe("closed")
    expect(t.onQueryChange).toHaveBeenLastCalledWith(null)
  })

  it("choosing inserts the label and a mention range; the caret after the space", () => {
    const t = make()
    t.type("hi @a")
    t.s.send({ type: "ITEM.CHOOSE", key: toKey("ada") })
    expect(t.v().value).toBe("hi @Ada ")
    expect(t.v().mentions).toEqual([{ id: "ada", trigger: "@", start: 3, end: 7 }])
    expect(env.setCaret).toHaveBeenLastCalledWith(8)
    expect(t.state()).toBe("closed")
  })

  it("Backspace at a mention's end removes it whole", () => {
    const t = make()
    t.type("hi @a")
    t.s.send({ type: "ITEM.CHOOSE", key: toKey("ada") })
    t.type("hi @Ad ", 6)
    expect(t.v()).toMatchObject({ value: "hi ", mentions: [] })
  })

  it("Escape dismisses the match; typing on in it stays closed", () => {
    const t = make()
    t.type("@a")
    t.s.send({ type: "ESCAPE", composing: false })
    t.type("@al")
    expect(t.state()).toBe("closed")
    t.type("@al @g")
    expect(t.state()).toBe("open")
  })

  it("an action trigger removes its query and calls onSelect", () => {
    const t = make()
    t.type("/gr")
    t.s.send({ type: "ITEM.CHOOSE", key: toKey("grace") })
    expect(t.v().value).toBe("")
    expect(t.onSelect).toHaveBeenCalledWith({ trigger: "/", key: "grace", text: "Grace" })
  })

  it("read-only never opens", () => {
    const t = make({ readOnly: true })
    t.type("@a")
    expect(t.state()).toBe("closed")
  })
})
