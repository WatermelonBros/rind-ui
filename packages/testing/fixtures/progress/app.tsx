// The page progress.pw.test.ts drives: a themed determinate bar with buttons that move the
// value, an indeterminate bar and an indeterminate ring, bundled by the test itself.
import { Progress } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [value, setValue] = useState(40)
  return (
    <main style={{ width: 320, display: "grid", gap: 16 }}>
      <button type="button" onClick={() => setValue((v) => Math.min(v + 30, 100))}>
        Advance
      </button>
      <Progress.Root value={value} announceCompletion>
        <Progress.Label>Uploading</Progress.Label>
        <Progress.ValueText />
        <Progress.Track data-testid="track">
          <Progress.Indicator data-testid="fill" />
        </Progress.Track>
      </Progress.Root>
      <Progress.Root value={null}>
        <Progress.Label>Connecting</Progress.Label>
        <Progress.Track>
          <Progress.Indicator data-testid="busy" />
        </Progress.Track>
      </Progress.Root>
      <Progress.Root value={null} aria-label="Syncing">
        <Progress.Circle data-testid="ring">
          <Progress.CircleTrack />
          <Progress.CircleIndicator data-testid="arc" />
        </Progress.Circle>
      </Progress.Root>
    </main>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
