// Round 2 E2: nothing scheduled by the announcer in one test is spoken or logged in the next
// (the per-test reset of @rind-ui/testing/setup clears timers and invalidates frames).
import { ANNOUNCEMENTS, domEnvironment, liveAnnouncer } from "@rind-ui/core"
import { expect, it } from "vitest"

const log = () =>
  (Reflect.get(globalThis, ANNOUNCEMENTS) as { message: string }[]).map((m) => m.message)
const regions = () =>
  Array.from(
    document.querySelectorAll("[data-live-announcer] [aria-live] > *"),
    (n) => n.textContent,
  )

it("A: leaves a keyed and an unkeyed message pending at the end", () => {
  const announcer = liveAnnouncer(domEnvironment())
  announcer.announce({ message: "keyed from A", key: "count" })
  announcer.announce({ message: "unkeyed from A" })
})

it("B: neither reaches B's log or regions", async () => {
  await new Promise((resolve) => setTimeout(resolve, 700))
  expect(log()).toEqual([])
  expect(regions()).toEqual([])
})
