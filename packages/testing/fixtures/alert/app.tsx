// The page alert.pw.test.ts drives: an error that appears after an action (announced once),
// a Retry button after it, and themed alerts in every tone × variant and in RTL for the
// captures. Bundled by the test itself (no Storybook, no site build).
import { Alert } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

const tones = ["accent", "neutral", "success", "warning", "danger"]

function App() {
  const [error, setError] = useState(false)
  return (
    <div style={{ display: "grid", gap: 16, padding: 24, maxWidth: 560 }}>
      <button type="button" onClick={() => setError(true)}>
        Save
      </button>
      {error && (
        <Alert.Root announce="assertive" data-tone="danger">
          <Alert.Icon label="Error">!</Alert.Icon>
          <Alert.Title>Couldn't save</Alert.Title>
          <Alert.Description>Disk full</Alert.Description>
          <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
        </Alert.Root>
      )}
      <button type="button">Retry</button>
      <div data-testid="tones" style={{ display: "grid", gap: 8 }}>
        {["soft", "solid", "outline"].flatMap((variant) =>
          tones.map((tone) => (
            <Alert.Root
              key={`${variant}-${tone}`}
              announce="off"
              data-variant={variant}
              data-tone={tone}
            >
              <Alert.Title>
                {variant} {tone}
              </Alert.Title>
            </Alert.Root>
          )),
        )}
      </div>
      <div dir="rtl" data-testid="rtl">
        <Alert.Root announce="off">
          <Alert.Icon>!</Alert.Icon>
          <Alert.Title>تم الحفظ</Alert.Title>
          <Alert.CloseTrigger>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" />
            </svg>
          </Alert.CloseTrigger>
        </Alert.Root>
      </div>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
