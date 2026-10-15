import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../../src/index"
import { DisclosureExample } from "./disclosure.fixture"

it("reading order when open: the trigger (expanded, controlling the content), then the content", async () => {
  const { container } = render(<DisclosureExample defaultOpen />)
  const log = await spokenLog(container, (virtual) => virtual.next())
  expect(log).toEqual(["button, Details, 1 control, expanded", "Body text"])
})

it("reading order when closed: hidden content is never read", async () => {
  const { container } = render(<DisclosureExample />)
  const log = await spokenLog(container, async (virtual) => {
    await virtual.next()
    await virtual.next()
  })
  expect(log.some((phrase) => phrase.includes("Body text"))).toBe(false)
  expect(log[0]).toContain("button, Details")
  expect(log[0]).toContain("not expanded")
})
