// The page hover-card.pw.test.ts drives: a themed profile preview, bundled by the test.
import { HoverCard } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{ padding: 40, display: "grid", gap: 24, justifyItems: "start" }}>
      <a href="/before">Before</a>
      <HoverCard.Root>
        <HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Positioner>
            <HoverCard.Content>
              <HoverCard.Arrow />
              <p>Designer in Lisbon.</p>
              <button type="button">Follow</button>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </HoverCard.Portal>
      </HoverCard.Root>
      <a href="/after">After</a>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
