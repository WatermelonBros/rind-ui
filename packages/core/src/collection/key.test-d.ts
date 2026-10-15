import { describe, it } from "vitest"
import { type CollectionKey, toKey } from "./key"

describe("collection key types", () => {
  it("an unbranded string is not a key", () => {
    // @ts-expect-error a plain string must be branded with toKey
    const bad: CollectionKey = "fr"
    void bad
  })

  it("toKey brands a string", () => {
    const ok: CollectionKey = toKey("fr")
    void ok
  })
})
