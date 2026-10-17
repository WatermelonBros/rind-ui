// Virtual screen reader reading order (task 5.5): the trigger (name, value, collapsed or
// expanded), then the list's name and its options with their selection states.
// The content is rendered inline (no Select.Portal): the virtual screen reader only reads
// inside the container it starts on, and a portal escapes to document.body.
import { Select } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]

it("reads the trigger with its value, the list's name, then Apple not selected and Pear selected", async () => {
  const { container } = render(
    <Select.Root items={ITEMS} defaultValue="pear" defaultOpen>
      <Select.Label>Fruit</Select.Label>
      <Select.Trigger>
        <Select.ValueText />
      </Select.Trigger>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            {ITEMS.map((i) => (
              <Select.Item key={i.key} value={i.key}>
                <Select.ItemText>{i.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 10; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const trigger = at(/combobox/)
  const list = at(/listbox/, trigger)
  const apple = at(/Apple/, list)
  const pear = at(/Pear/, apple)
  const order = [trigger, list, apple, pear]
  const ctx = JSON.stringify({ order, log })
  expect(
    order.every((i) => i >= 0),
    ctx,
  ).toBe(true)
  expect(log[trigger], ctx).toMatch(/Fruit/)
  expect(log[trigger], ctx).toMatch(/expanded/)
  expect(log[list], ctx).toMatch(/Fruit/)
  expect(log[apple], ctx).toMatch(/not selected/)
  expect(log[pear], ctx).toMatch(/selected/)
  expect(log[pear], ctx).not.toMatch(/not selected/)
})
