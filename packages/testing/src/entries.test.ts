import { describe, expect, it, vi } from "vitest"

// A Playwright-only project has no Testing Library: importing it must throw here.
vi.mock("@testing-library/dom", () => {
  throw new Error("Testing Library was loaded")
})
vi.mock("@testing-library/user-event", () => {
  throw new Error("user-event was loaded")
})

describe("optional peers", () => {
  it("the Playwright entry and the main entry load without Testing Library", async () => {
    const pw = await import("./playwright")
    const main = await import("./index")
    expect(typeof pw.playwrightEnv).toBe("function")
    expect(typeof main.createDriver).toBe("function")
    // Deadline, not a delay: transforming both entries' module graphs is slow on a loaded machine.
  }, 30_000)
})
