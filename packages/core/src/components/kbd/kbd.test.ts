import { describe, expect, it } from "vitest"
import { kbdConnect } from "./kbd.connect"
import { kbdContract } from "./kbd.contract"
import { keyShortcuts, parseKeys } from "./kbd.keys"
import { kbdMessages } from "./kbd.messages"
import { kbdMeta } from "./kbd.meta"

const api = (keys: string, apple: boolean) =>
  kbdConnect({ instance: "k", chords: parseKeys(keys), apple, messages: kbdMessages })
const shown = (keys: string, apple: boolean) => {
  const a = api(keys, apple)
  return a.items.map((i) => (i.type === "key" ? i.key.glyph : a.separatorText(i.kind))).join("")
}

describe("kbd keys", () => {
  it("parses chords and sequences, case-insensitively, with aliases", () => {
    expect(parseKeys("Mod+Shift+P")).toEqual([["mod", "shift", "p"]])
    expect(parseKeys("g i")).toEqual([["g"], ["i"]])
    expect(parseKeys(["Cmd", "K"])).toEqual([["meta", "k"]])
    expect(parseKeys("ctrl++")).toEqual([["ctrl", "+"]])
  })

  it("mod is ⌘ on Apple and Ctrl elsewhere; glyphs only on Apple", () => {
    expect(shown("mod+k", true)).toBe("⌘K")
    expect(shown("mod+k", false)).toBe("Ctrl+K")
    expect(shown("mod+shift+p", true)).toBe("⌘⇧P")
    expect(shown("alt+enter", false)).toBe("Alt+Enter")
    // HeroUI rendered ⌘ for the Windows key.
    expect(shown("win+e", false)).toBe("Win+E")
  })

  it("speaks names for glyphs and abbreviations (never 'place of interest sign')", () => {
    expect(api("mod+shift+p", true).spoken).toBe("Command plus Shift plus P")
    expect(api("ctrl+k", false).spoken).toBe("Control plus K")
    expect(api("alt+up", true).spoken).toBe("Option plus Up Arrow")
    expect(api("g i", false).spoken).toBe("G then I")
  })

  it("aria-keyshortcuts for a chord; none for a sequence (React Spectrum #6478)", () => {
    expect(keyShortcuts("mod+s", false)).toBe("Control+S")
    expect(keyShortcuts("mod+shift+p", true)).toBe("Meta+Shift+P")
    expect(keyShortcuts("alt+up", false)).toBe("Alt+ArrowUp")
    expect(keyShortcuts("g i", false)).toBeUndefined()
  })
})

describe("kbd connect", () => {
  it("a glyph that is not its name is hidden next to the name; a letter is itself", () => {
    const a = api("mod+k", true)
    const [cmd, , k] = a.items
    if (cmd?.type !== "key" || k?.type !== "key") throw new Error("keys expected")
    expect(a.glyph(cmd.key)).toEqual({ "aria-hidden": "true" })
    expect(a.keyLabel(cmd.key)).toBe("Command")
    expect(a.glyph(k.key)).toEqual({})
    expect(a.keyLabel(k.key)).toBeNull()
    expect(a.root()).toMatchObject({ dir: "ltr", "data-platform": "apple" })
    expect(a.key(cmd.key)["data-key"]).toBe("meta")
  })
})

describe("kbd meta matches the code", () => {
  it("contract and data attributes", () => {
    expect(kbdMeta.contract.queries).toEqual(Object.keys(kbdContract.queries))
    const a = api("mod+k", true)
    const [key] = a.items
    if (key?.type !== "key") throw new Error("key expected")
    const data = (p: Record<string, unknown>) =>
      Object.keys(p)
        .filter((k) => k.startsWith("data-"))
        .sort()
    expect(Object.keys(kbdMeta.dataAttributes.root).sort()).toEqual(data(a.root()))
    expect(Object.keys(kbdMeta.dataAttributes.key).sort()).toEqual(data(a.key(key.key)))
    expect(Object.keys(kbdMeta.dataAttributes.separator).sort()).toEqual(data(a.separator("chord")))
  })
})
