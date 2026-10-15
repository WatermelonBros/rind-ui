import { describe, expect, it } from "vitest"
// @ts-expect-error a plain .mjs script without types
import { issueBody } from "./report.mjs"

const env = { sr: "NVDA", browser: "Chrome", runLink: "https://run" }
const result = (status: string) => ({
  suites: [
    {
      specs: [
        {
          title: "disclosure",
          tests: [
            {
              projectName: "nvda-chrome",
              results: [{ status, error: { message: 'missing ["expanded"]' } }],
              annotations: [
                { type: "spoken", description: '["Details, button"]' },
                {
                  type: "versions",
                  description: JSON.stringify({
                    screenReader: "NVDA 2026.3",
                    browser: "chromium 141.0",
                    os: "Windows (10.0.26100)",
                  }),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})

describe("nightly issue body", () => {
  it("names the failing flow with the phrase diff, spoken log and versions", () => {
    const body = issueBody(result("failed"), env)
    expect(body).toContain("### nvda-chrome: disclosure")
    expect(body).toContain("Screen reader: NVDA 2026.3 · Browser: chromium 141.0 · OS: Windows")
    expect(body).toContain('missing ["expanded"]')
    expect(body).toContain('["Details, button"]')
  })
  it("is empty when everything passed", () => {
    expect(issueBody(result("passed"), env)).toBe("")
  })
  it("reports an infrastructure failure when no results exist", () => {
    expect(issueBody(null, env)).toContain("failed before the golden flows ran")
    expect(issueBody(null, env)).toContain("https://run")
  })

  it("reports a webServer / global setup failure (errors, no suites)", () => {
    const body = issueBody(
      { suites: [], errors: [{ message: "Error: Process from config.webServer exited early." }] },
      env,
    )
    expect(body).toContain("failed outside the golden flows (server or setup)")
    expect(body).toContain("config.webServer exited early")
  })
  it("never stays silent on unexpected results without a failing flow", () => {
    expect(issueBody({ suites: [], stats: { unexpected: 1 } }, env)).toContain(
      "1 unexpected result(s)",
    )
  })
})
