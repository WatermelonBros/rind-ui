import { describe, it } from "vitest"
import { defineQuirks, quirkActive } from "./quirks"

describe("quirk types", () => {
  it("an entry needs at least one link", () => {
    defineQuirks([
      {
        id: "x",
        when: () => true,
        // @ts-expect-error links must not be empty
        links: [],
        test: "x.test.ts",
        removeWhen: "never",
        verified: "2026-01-01",
      },
    ])
  })

  it("unknown ids do not compile", () => {
    // @ts-expect-error not a registered quirk
    quirkActive("no-such-quirk", { platform: {} as never })
  })
})
