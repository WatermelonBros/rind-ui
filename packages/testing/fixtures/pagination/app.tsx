// The page pagination.pw.test.ts drives: a link-mode pagination whose page comes from the
// URL, and a button pagination for the driver, bundled by the test itself.
import { Pagination, type PaginationRootProps } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

declare global {
  interface Window {
    changes: number[]
  }
}
window.changes = []

function Pager(props: PaginationRootProps) {
  return (
    <Pagination.Root {...props}>
      {(state) => (
        <Pagination.List>
          <Pagination.Item type="trigger">
            <Pagination.Previous />
          </Pagination.Item>
          {state.pages.map((e) =>
            e.type === "page" ? (
              <Pagination.Item key={e.key}>
                <Pagination.Page value={e.value} />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={e.key} type="ellipsis">
                <Pagination.Ellipsis position={e.position} />
              </Pagination.Item>
            ),
          )}
          <Pagination.Item type="trigger">
            <Pagination.Next />
          </Pagination.Item>
        </Pagination.List>
      )}
    </Pagination.Root>
  )
}

const fromUrl = Number(new URLSearchParams(location.search).get("page") ?? "1")

function App() {
  return (
    <div style={{ display: "grid", gap: 24, padding: 24 }}>
      <Pager
        aria-label="Posts"
        totalPages={10}
        defaultPage={fromUrl}
        getPageHref={(p) => `/posts?page=${p}`}
        onPageChange={(p) => window.changes.push(p)}
      />
      <Pager aria-label="Results" totalPages={20} />
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
