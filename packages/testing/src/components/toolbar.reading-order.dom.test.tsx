// add-toolbar 5.5: a screen reader reaches the toolbar's name, then each control with its
// role and state, in document order.
import { ToggleGroup, Toolbar } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

it("the toolbar name, then controls with their roles and states, separators between", async () => {
  const { container } = render(
    <Toolbar.Root aria-label="Formatting">
      <Toolbar.Button>Undo</Toolbar.Button>
      <Toolbar.Separator />
      <ToggleGroup.Root aria-label="Style" defaultValue={["b"]} selectionMode="multiple">
        <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Link href="/docs">Docs</Toolbar.Link>
    </Toolbar.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 16; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const toolbar = at(/toolbar.*Formatting|Formatting.*toolbar/)
  const undo = at(/Undo/, toolbar)
  const sep = at(/separator/, undo)
  const group = at(/group.*Style|Style.*group/, sep)
  const bold = at(/Bold/, group)
  const italic = at(/Italic/, bold)
  const docs = at(/link.*Docs|Docs.*link/, italic)
  const order = [toolbar, undo, sep, group, bold, italic, docs]
  expect(
    order.every((i) => i >= 0),
    JSON.stringify({ order, log }),
  ).toBe(true)
  expect(log[undo]).toMatch(/button/)
  expect(log[bold]).toMatch(/button/)
  expect(log[bold]).toMatch(/pressed/)
  expect(log[italic]).not.toMatch(/(?<!not )pressed/)
  expect(log[sep]).toMatch(/vertical/)
})
