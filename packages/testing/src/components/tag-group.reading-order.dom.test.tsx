// add-tag-group 5.3: what a screen reader reads through a removable, selectable group: the
// group's name, each row named by its text alone (not "Remove …"), the selection state, and
// the remove buttons as separate buttons.
import { TagGroup } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

it("group name, rows without the remove label, selection state, buttons", async () => {
  const { container } = render(
    <TagGroup.Root selectionMode="multiple" defaultValue={["Paris"]} onRemove={() => {}}>
      <TagGroup.Label>Cities</TagGroup.Label>
      <TagGroup.List>
        {["Rome", "Paris"].map((t) => (
          <TagGroup.Tag key={t} value={t}>
            <TagGroup.TagText>{t}</TagGroup.TagText>
            <TagGroup.TagRemove />
          </TagGroup.Tag>
        ))}
      </TagGroup.List>
    </TagGroup.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 14; i++) await virtual.next()
  })
  const text = log.join(" | ")
  expect(text).toMatch(/grid, Cities/)
  const rows = log.filter((p) => p.startsWith("row"))
  expect(rows.some((p) => p.includes("Rome") && !p.includes("Remove"))).toBe(true)
  expect(rows.some((p) => p.includes("Paris") && p.includes("selected"))).toBe(true)
  expect(log.some((p) => p.startsWith("button, Remove Rome"))).toBe(true)
})
