import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { linkConnect } from "./link.connect"
import { linkContract } from "./link.contract"
import { linkMeta } from "./link.meta"

describe("link meta matches the code", () => {
  it("contract actions, modalities, queries and traits", () => {
    const actions = Object.fromEntries(
      Object.entries(linkContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(linkMeta.contract.actions).toEqual(actions)
    expect(linkMeta.contract.queries).toEqual(Object.keys(linkContract.queries))
    expect(linkMeta.contract.traits).toEqual(linkContract.traits)
  })

  it("documents every data attribute the part can carry", () => {
    const env = {
      platform: platforms.linux,
      modality: { modality: () => "pointer" as const },
    } as unknown as Parameters<typeof linkConnect>[1] // only platform and modality are read
    const keys = new Set<string>(["data-focus", "data-focus-visible", "data-hover", "data-pressed"])
    for (const input of [
      { href: "https://example.org", current: "page" as const },
      { href: "/a", disabled: true },
    ]) {
      for (const k of Object.keys(linkConnect({ ...input, tag: "a", instance: "i" }, env))) {
        if (k.startsWith("data-")) keys.add(k)
      }
    }
    expect(Object.keys(linkMeta.dataAttributes.link).sort()).toEqual([...keys].sort())
  })
})
