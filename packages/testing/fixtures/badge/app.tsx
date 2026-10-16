// The page badge.pw.test.ts drives: themed Badges on icon buttons, bundled by the test itself
// (no Storybook, no site build).
import { Badge, VisuallyHidden } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{ display: "grid", gap: 24, padding: 24, justifyItems: "start" }}>
      <button type="button">
        <VisuallyHidden>Comments</VisuallyHidden> <Badge.Root label="3 unread">3</Badge.Root>
      </button>
      <button type="button" aria-label="Notifications" aria-describedby="n">
        <Badge.Root id="n" label="more than 99 notifications" data-tone="danger">
          99+
        </Badge.Root>
      </button>
      <p>
        Search <Badge.Root data-variant="outline">Beta</Badge.Root>
      </p>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
