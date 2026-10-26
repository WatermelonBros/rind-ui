// Virtual screen reader reading order for a menubar (task 5.4): the menubar's name, its
// items with "has popup", then the open menu named by its item. The content is rendered
// inline (no Menu.Portal): the virtual screen reader reads inside its container only.
import { Menu, Menubar } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { expectRindWarning, spokenLog } from "../index"

it("reads the menubar, its items with a popup, then the open menu named by its item", async () => {
  // Inline on purpose (the virtual screen reader reads its container only).
  expectRindWarning(/menubar: a menu's content is rendered inside the bar/)
  const { container } = render(
    <Menubar.Root aria-label="Application" defaultValue="Edit">
      {["File", "Edit"].map((l) => (
        <Menubar.Menu key={l} value={l}>
          <Menubar.Trigger>{l}</Menubar.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item>{`${l} first`}</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menubar.Menu>
      ))}
    </Menubar.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 12; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const bar = at(/menubar.*Application|Application.*menubar/)
  const file = at(/File/, bar)
  const edit = at(/Edit/, file + 1)
  const menu = at(/menu.*Edit|Edit.*menu/, edit + 1)
  const ctx = JSON.stringify({ bar, file, edit, menu, log })
  expect(
    [bar, file, edit, menu].every((i) => i >= 0),
    ctx,
  ).toBe(true)
  expect(log[file], ctx).toMatch(/menuitem/)
  expect(log[file], ctx).toMatch(/popup|has popup|haspopup/i)
  expect(log[edit], ctx).toMatch(/expanded/)
})
