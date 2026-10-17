// The page meter.pw.test.ts drives: three themed battery meters, one per zone.
import { Meter } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const zones = [
  ["Battery full", 90],
  ["Battery half", 50],
  ["Battery low", 10],
] as const

function App() {
  return (
    <main style={{ width: 320, display: "grid", gap: 16 }}>
      {zones.map(([name, value]) => (
        <Meter.Root key={name} value={value} low={20} high={80} optimum={100}>
          <Meter.Label>{name}</Meter.Label>
          <Meter.ValueText />
          <Meter.Track>
            <Meter.Indicator data-testid={name} />
          </Meter.Track>
        </Meter.Root>
      ))}
    </main>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
