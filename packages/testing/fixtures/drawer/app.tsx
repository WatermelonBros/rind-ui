// The page drawer.pw.test.ts drives: a bottom drawer with a long list, a snap-point sheet with a
// handle, and an indent around the page, bundled by the test.
import { Drawer } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <Drawer.Indent data-testid="indent" style={{ padding: 24, background: "canvas" }}>
      <main style={{ display: "grid", gap: 16, justifyItems: "start" }}>
        <Drawer.Root>
          <Drawer.Trigger>Filters</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content style={{ maxBlockSize: "60dvh" }}>
                <Drawer.Title>Filters</Drawer.Title>
                <Drawer.Description>Narrow the results.</Drawer.Description>
                {/* Before the list: the initial focus must not scroll it to the end. */}
                <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
                <ul data-testid="list" style={{ margin: 0, paddingInlineStart: 20 }}>
                  {Array.from({ length: 60 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a static list
                    <li key={i} style={{ blockSize: 36 }}>
                      Filter {i + 1}
                    </li>
                  ))}
                </ul>
              </Drawer.Content>
            </Drawer.Positioner>
          </Drawer.Portal>
        </Drawer.Root>

        <Drawer.Root snapPoints={[0.4, 1]}>
          <Drawer.Trigger>Sheet</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content style={{ blockSize: "90dvh" }}>
                <Drawer.Handle />
                <Drawer.Title>Sheet</Drawer.Title>
                <Drawer.Description>A sheet with two snap points.</Drawer.Description>
                <p>Content.</p>
              </Drawer.Content>
            </Drawer.Positioner>
          </Drawer.Portal>
        </Drawer.Root>
      </main>
    </Drawer.Indent>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
