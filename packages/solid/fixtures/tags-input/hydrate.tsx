/** @jsxImportSource solid-js */
import { TagsInput } from "../../src/tags-input"

const ITEMS = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

export function App() {
  return (
    <div>
      <TagsInput.Root items={ITEMS} defaultValue={["rome"]} name="tags" id="tags">
        <TagsInput.Label>Tags</TagsInput.Label>
        <TagsInput.Control>
          <TagsInput.Chips />
          <TagsInput.Input />
          <TagsInput.ClearTrigger />
        </TagsInput.Control>
        <TagsInput.Positioner>
          <TagsInput.Popup>
            <TagsInput.List>
              <TagsInput.Items />
            </TagsInput.List>
          </TagsInput.Popup>
        </TagsInput.Positioner>
      </TagsInput.Root>
    </div>
  )
}
