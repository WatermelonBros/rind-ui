// add-separator 5.2: a screen reader says "separator" between two paragraphs and nothing for
// the decorative one.
import { Separator } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

const readAll = (container: HTMLElement, steps: number) =>
  spokenLog(container, async (virtual) => {
    for (let i = 0; i < steps; i++) await virtual.next()
  })

it("a semantic separator is spoken between the paragraphs", async () => {
  const { container } = render(
    <>
      <p>One</p>
      <Separator.Root />
      <p>Two</p>
    </>,
  )
  const log = await readAll(container, 9)
  const one = log.findIndex((p) => p.includes("One"))
  const sep = log.findIndex((p) => p.startsWith("separator"))
  const two = log.findIndex((p) => p.includes("Two"))
  expect(one).toBeGreaterThanOrEqual(0)
  expect(sep).toBeGreaterThan(one)
  expect(two).toBeGreaterThan(sep)
})

it("a decorative separator is not spoken", async () => {
  const { container } = render(
    <>
      <p>One</p>
      <Separator.Root decorative />
      <p>Two</p>
    </>,
  )
  const log = await readAll(container, 9)
  expect(log.some((p) => p.includes("separator"))).toBe(false)
  expect(log.some((p) => p.includes("One"))).toBe(true)
  expect(log.some((p) => p.includes("Two"))).toBe(true)
})
