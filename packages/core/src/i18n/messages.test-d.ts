import { describe, it } from "vitest"
import { resolveMessages } from "./messages"

const defaults = { close: "Close", count: (n: number) => `${n}` }

describe("message types", () => {
  it("rejects unknown keys and wrong parameter types", () => {
    // @ts-expect-error "clsoe" is not a message of this component
    resolveMessages(defaults, { clsoe: "Chiudi" })
    // @ts-expect-error count takes a number
    resolveMessages(defaults, { count: (s: string) => s })
  })
})
