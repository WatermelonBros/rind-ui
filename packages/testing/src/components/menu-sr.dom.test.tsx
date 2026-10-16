// Virtual screen reader reading order for an open menu: its name (from the trigger), then
// the checkbox item and radio items with their checked states, in DOM order.
// The content is rendered inline (no Menu.Portal): the virtual screen reader only reads
// inside the container it starts on, and a portal escapes to document.body.
import { Menu } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

it("reads the menu name, then Minimap checked, then List checked and Grid", async () => {
  const { container } = render(
    <Menu.Root defaultOpen>
      <Menu.Trigger>View</Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.CheckboxItem defaultChecked>Minimap</Menu.CheckboxItem>
          <Menu.Separator />
          <Menu.RadioGroup defaultValue="list">
            <Menu.RadioItem value="list">List</Menu.RadioItem>
            <Menu.RadioItem value="grid">Grid</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 14; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const menu = at(/menu.*View|View.*menu/)
  const minimap = at(/Minimap/, menu)
  const list = at(/List/, minimap)
  const grid = at(/Grid/, list)
  const order = [menu, minimap, list, grid]
  const ctx = JSON.stringify({ order, log })
  expect(
    order.every((i) => i >= 0),
    ctx,
  ).toBe(true)
  expect(log[minimap], ctx).toMatch(/checkbox|menuitemcheckbox/)
  expect(log[minimap], ctx).toMatch(/checked/)
  expect(log[minimap], ctx).not.toMatch(/not checked/)
  expect(log[list], ctx).toMatch(/radio/)
  expect(log[list], ctx).not.toMatch(/not checked/)
  expect(log[list], ctx).toMatch(/checked/)
  expect(log[grid], ctx).toMatch(/not checked/)
})
