// Ported from the Storybook play functions of Link: FollowedWithDriver, Queries, DisabledQuery.
import { describe, expect, it } from "vitest"
import { getLink } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("link")

describe("link stories (ported play functions)", () => {
  it("FollowedWithDriver", { timeout: 60_000 }, async () => {
    const page = await open("followed-with-driver")
    // followInNewTab opens /docs in a new tab; the static server has no page for it (it is a
    // directory), so answer it here: only the router must stay uncalled.
    await page.context().route("**/docs", (route) => route.fulfill({ body: "" }))
    const link = getLink(page, { name: "Documentation" })
    const calls = page.getByTestId("calls")
    await link.follow()
    expect(await calls.textContent()).toContain("Router calls: /docs")
    await link.via("keyboard").follow()
    expect(await calls.textContent()).toContain("Router calls: /docs, /docs")
    await link.followInNewTab()
    expect(await calls.textContent()).toContain("Router calls: /docs, /docs")
  })

  it("Queries", { timeout: 60_000 }, async () => {
    const page = await open("queries")
    const link = getLink(page, { name: "Documentation" })
    expect(await link.isExternal()).toBe(true)
    expect(await link.current()).toBe("page")
    expect(await link.isDisabled()).toBe(false)
    expect(await link.href()).toBe("https://example.org")
  })

  it("DisabledQuery", { timeout: 60_000 }, async () => {
    const page = await open("disabled-query")
    expect(await getLink(page, { name: "Documentation" }).isDisabled()).toBe(true)
  })
})
