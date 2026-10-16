// The page skeleton.pw.test.ts drives: a themed Skeleton with a load toggle and a circle
// placeholder, bundled by the test itself (no Storybook, no site build).
import { Skeleton } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [loading, setLoading] = useState(true)
  return (
    <section aria-label="Comments" style={{ width: 320 }}>
      <button type="button" onClick={() => setLoading((l) => !l)}>
        Toggle
      </button>
      <Skeleton.Root loading={loading} announceOnLoad="12 comments loaded">
        <Skeleton.Status />
        <Skeleton.Content>
          <Skeleton.Item
            data-testid="circle"
            style={
              {
                display: "block",
                inlineSize: 48,
                blockSize: 48,
                "--rind-skeleton-radius": "9999px",
              } as React.CSSProperties
            }
          />
          <Skeleton.Item data-testid="line" />
          <p>
            <Skeleton.Item data-testid="text">Stale comment text that wraps</Skeleton.Item>
          </p>
        </Skeleton.Content>
      </Skeleton.Root>
    </section>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
