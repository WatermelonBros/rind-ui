// The page scroll-area.pw.test.ts drives: themed Scroll Areas (vertical text-only, both axes,
// RTL), bundled by the test itself (no Storybook, no site build).
import { ScrollArea } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const lines = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).map((text) => (
    <p key={text} style={{ margin: 0, padding: 4 }}>
      {text}
    </p>
  ))

function Area({ label, wide = false }: { readonly label: string; readonly wide?: boolean }) {
  return (
    <ScrollArea.Root type="always" style={{ inlineSize: 240, blockSize: 160 }}>
      <ScrollArea.Viewport aria-label={label}>
        <ScrollArea.Content style={wide ? { inlineSize: 600 } : undefined}>
          {lines(30, label)}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      {wide && (
        <ScrollArea.Scrollbar orientation="horizontal">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      )}
      {wide && <ScrollArea.Corner />}
    </ScrollArea.Root>
  )
}

function App() {
  return (
    <main style={{ display: "flex", gap: 24, padding: 16 }}>
      <Area label="Release notes" />
      <Area label="Table" wide />
      <div dir="rtl">
        <Area label="ملاحظات" wide />
      </div>
    </main>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
