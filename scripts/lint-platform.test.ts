import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { checkQuirks } from "./quirks-check"

const run = (...dirs: string[]) =>
  spawnSync(process.execPath, ["scripts/lint-platform.mjs", ...dirs], { encoding: "utf8" })

describe("platform lint", () => {
  it("fails on a user agent or platform-flag read outside the allowed modules", () => {
    const result = run("scripts/fixtures/platform-violation")
    expect(result.status).toBe(1)
    const lines = [...result.stderr.matchAll(/sniff\.ts:(\d+)/g)].map((m) => Number(m[1]))
    // userAgent, member access, bare parameter, destructuring, string key, parameter pattern;
    // not the convention (12) or prose (14).
    expect(lines).toEqual([2, 3, 4, 6, 9, 10])
  })

  it("passes on the packages", () => {
    expect(run().status).toBe(0)
  })
})

describe("quirks check", () => {
  const entry = {
    id: "old",
    links: ["https://example.com/bug"],
    test: "nope.test.ts",
    removeWhen: "fixed",
    verified: "2025-09-01",
  }
  it("reports a stale entry with its id, links and removal condition", () => {
    const { stale } = checkQuirks([entry], { exists: () => true, today: new Date("2026-10-14") })
    expect(stale).toEqual([
      "old: last verified 2025-09-01 — re-test (https://example.com/bug); remove when fixed",
    ])
  })
  it("fails on a missing test path", () => {
    const { missing } = checkQuirks([entry], { exists: () => false, today: new Date("2026-01-01") })
    expect(missing).toEqual(["old: test nope.test.ts does not exist"])
  })
})
