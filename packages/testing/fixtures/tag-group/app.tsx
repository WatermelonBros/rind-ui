// The page tag-group.pw.test.ts drives: a themed removable Tag Group whose onRemove drops the
// keys, bundled by the test itself (no site build).
import { TagGroup } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [tags, setTags] = useState(["Rome", "Paris", "Oslo"])
  return (
    <div style={{ display: "grid", gap: 24, padding: 24, justifyItems: "start" }}>
      <button type="button">Before</button>
      <TagGroup.Root
        selectionMode="multiple"
        defaultValue={["Paris"]}
        onRemove={(keys) => setTags((all) => all.filter((t) => !keys.includes(t)))}
      >
        <TagGroup.Label>Cities</TagGroup.Label>
        <TagGroup.List>
          {tags.map((t) => (
            <TagGroup.Tag key={t} value={t}>
              <TagGroup.TagText>{t}</TagGroup.TagText>
              <TagGroup.TagRemove />
            </TagGroup.Tag>
          ))}
          <TagGroup.Empty>No cities</TagGroup.Empty>
        </TagGroup.List>
      </TagGroup.Root>
      <button type="button">After</button>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
