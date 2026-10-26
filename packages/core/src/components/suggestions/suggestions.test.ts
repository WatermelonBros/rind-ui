import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { suggestionsConnect } from "./suggestions.connect"
import { suggestionsContract } from "./suggestions.contract"
import { type SuggestionsProps, suggestionsMachine } from "./suggestions.machine"
import { suggestionsMessages } from "./suggestions.messages"
import { suggestionsMeta } from "./suggestions.meta"

function make(over: Partial<SuggestionsProps> = {}) {
  const announced: Announcement[] = []
  const onSelect = vi.fn()
  const props: SuggestionsProps = { id: "s", onSelect, ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
  }
  const s = createService(suggestionsMachine, props, env)
  s.start()
  const press = (focusWasInside = false, itemDisabled = false) =>
    s.send({
      type: "PRESS",
      key: "a",
      value: "Summarise this",
      index: 0,
      itemDisabled,
      focusWasInside,
    })
  return { s, props, announced, onSelect, press, state: () => s.getSnapshot().state }
}

describe("suggestions machine", () => {
  it("a press calls onSelect with the value", () => {
    const t = make()
    t.press()
    expect(t.onSelect).toHaveBeenCalledWith({ value: "Summarise this", index: 0, key: "a" })
  })

  it("loading and disabled ignore presses; the state follows the props", () => {
    const t = make({ loading: true })
    expect(t.state()).toBe("loading")
    t.press()
    t.s.setProps({ ...t.props, loading: false, disabled: true })
    expect(t.state()).toBe("disabled")
    t.press()
    t.s.setProps({ ...t.props, loading: false, disabled: false })
    expect(t.state()).toBe("ready")
    expect(t.onSelect).not.toHaveBeenCalled()
  })

  it("a disabled item does nothing", () => {
    const t = make()
    t.press(false, true)
    expect(t.onSelect).not.toHaveBeenCalled()
  })

  it("focus moves to focusTarget only when the press began inside", () => {
    const focus = vi.fn()
    const t = make({ focusTarget: () => ({ focus }) })
    t.press(false)
    expect(focus).not.toHaveBeenCalled()
    t.press(true)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it("announces a new set only with announce=polite, never on mount", () => {
    const quiet = make()
    quiet.s.send({ type: "ITEMS", keys: ["a", "b"] })
    quiet.s.send({ type: "ITEMS", keys: ["c"] })
    expect(quiet.announced).toHaveLength(0)
    const t = make({ announce: "polite" })
    t.s.send({ type: "ITEMS", keys: ["a", "b", "c"] })
    t.s.send({ type: "ITEMS", keys: ["a", "b", "c"] })
    expect(t.announced).toHaveLength(0)
    t.s.send({ type: "ITEMS", keys: ["d", "e"] })
    expect(t.announced.map((a) => a.message)).toEqual(["2 suggestions"])
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof suggestionsConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof suggestionsConnect>[0]> = {}) =>
  suggestionsConnect(
    {
      instance: "s",
      state: "ready",
      count: 3,
      messages: suggestionsMessages,
      named: false,
      ...over,
    },
    env,
  )
const item = {
  key: "a",
  index: 0,
  disabled: false,
  tag: "button",
  focused: true,
  modality: "keyboard" as const,
}
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("suggestions connect and meta", () => {
  it("a named group; busy while loading", () => {
    expect(api().root()).toMatchObject({
      role: "group",
      "aria-label": "Suggestions",
      "data-count": "3",
    })
    expect(api({ named: true }).root()["aria-label"]).toBeUndefined()
    expect(api({ state: "loading" }).root()["aria-busy"]).toBe("true")
  })

  it("items stay focusable while loading (assistant-ui#8940)", () => {
    const p = api({ state: "loading" }).item(item)
    expect(p["aria-disabled"]).toBe("true")
    expect(p["disabled"]).toBeUndefined()
    expect(p).toMatchObject({ type: "button", "data-key": "a", "data-index": "0" })
  })

  it("meta matches the code", () => {
    const a = api({ state: "loading" })
    const parts = {
      root: a.root(),
      item: a.item(item),
      label: a.label(),
      description: a.description(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        suggestionsMeta.dataAttributes[part as keyof typeof suggestionsMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(suggestionsMeta.contract.queries).toEqual(Object.keys(suggestionsContract.queries))
    expect(Object.keys(suggestionsMeta.states)).toEqual(Object.keys(suggestionsMachine.def.states))
  })
})
