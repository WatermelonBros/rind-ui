import { describe, expectTypeOf, it } from "vitest"
import type { QuirkId, quirkConditions } from "./quirk-conditions"
import type { QuirkMeta, QuirksAffecting, quirkMeta } from "./quirk-meta"
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

  it("conditions and metadata have the same ids", () => {
    expectTypeOf<keyof typeof quirkMeta>().toEqualTypeOf<QuirkId>()
    expectTypeOf<keyof typeof quirkConditions>().toEqualTypeOf<keyof typeof quirkMeta>()
  })

  it("a condition without metadata does not compile", () => {
    const meta = {
      links: ["https://example.com"],
      test: "x.test.ts",
      removeWhen: "never",
      verified: "2026-01-01",
    } as const
    // The same check quirk-meta.ts makes: one id of two has no metadata.
    // @ts-expect-error property "b" is missing
    ;({ a: meta }) satisfies Record<"a" | "b", QuirkMeta>
    // @ts-expect-error metadata for an id with no condition
    ;({ a: meta, b: meta, c: meta }) satisfies Record<"a" | "b", QuirkMeta>
  })

  it("contract exceptions infer from the metadata", () => {
    expectTypeOf<QuirksAffecting<"state-attrs">>().toEqualTypeOf<"vo-submenu-expanded">()
  })
})
