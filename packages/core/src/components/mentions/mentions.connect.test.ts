import { describe, expect, it } from "vitest"
import { createListCollection } from "../../collection/list"
import { initialCollectionContext } from "../../collection/machine"
import { platforms } from "../../dom/platform"
import { initialPatternContext } from "../combobox/pattern/machine"
import { highlightSegments, mentionsConnect } from "./mentions.connect"
import { mentionsContract } from "./mentions.contract"
import { mentionsMachine } from "./mentions.machine"
import { mentionsMessages } from "./mentions.messages"
import { mentionsMeta } from "./mentions.meta"

const people = createListCollection({
  items: [{ id: "ada", label: "Ada" }],
  getKey: (r) => r.id,
  getText: (r) => r.label,
})
const env = {
  platform: platforms.linux,
  dom: { getById: () => null },
} as unknown as Parameters<typeof mentionsConnect>[1] // platform and dom are what is read
const api = (open: boolean) =>
  mentionsConnect(
    {
      instance: "m",
      open,
      empty: false,
      results: people,
      context: { ...initialCollectionContext(), ...initialPatternContext() } as never,
      disabled: true,
      readOnly: true,
      composing: true,
      modality: "keyboard",
      dir: "ltr",
      mounted: { label: false, empty: false },
      blur: () => {},
      value: "hi @Ada",
      mentions: [{ id: "ada", trigger: "@", start: 3, end: 7 }],
      match: open ? { trigger: "@", start: 3, end: 5, query: "Ad" } : null,
      triggers: ["@"],
      messages: mentionsMessages,
      send: () => {},
    },
    env,
  )
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("mentions connect", () => {
  it("a textbox until the list opens, then a combobox", () => {
    expect(api(false).textarea()["role"]).toBeUndefined()
    expect(api(true).textarea()).toMatchObject({ role: "combobox", "aria-expanded": "true" })
    expect(api(false).description).toBe("Type @ to insert a mention")
  })

  it("the Highlighter is decorative and cut into segments", () => {
    expect(api(false).highlighter()["aria-hidden"]).toBe("true")
    expect(
      highlightSegments("hi @Ada!", [{ id: "ada", trigger: "@", start: 3, end: 7 }]).map(
        (s) => s.kind,
      ),
    ).toEqual(["text", "mention", "text"])
  })

  it("meta matches the code", () => {
    const a = api(true)
    const parts = {
      root: a.root(),
      textarea: a.textarea(),
      highlighter: a.highlighter(),
      mention: a.mention({ id: "ada", trigger: "@", start: 3, end: 7 }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = mentionsMeta.dataAttributes[part as keyof typeof mentionsMeta.dataAttributes]
      const keys = dataKeys(props).filter((k) => !k.startsWith("data-focus"))
      expect(Object.keys(meta).sort(), part).toEqual(keys)
    }
    expect(mentionsMeta.contract.queries).toEqual(Object.keys(mentionsContract.queries))
    expect(Object.keys(mentionsMeta.states)).toEqual(Object.keys(mentionsMachine.def.states))
  })
})
