/** @jsxImportSource solid-js */
import { Pagination } from "@rind-ui/solid"
import { For } from "solid-js"

export function Basic() {
  return (
    <Pagination.Root totalPages={10}>
      {(state) => (
        <Pagination.List>
          <Pagination.Item type="trigger">
            <Pagination.Previous />
          </Pagination.Item>
          <For each={state.pages}>
            {(e) =>
              e.type === "page" ? (
                <Pagination.Item>
                  <Pagination.Page value={e.value} />
                </Pagination.Item>
              ) : (
                <Pagination.Item type="ellipsis">
                  <Pagination.Ellipsis position={e.position} />
                </Pagination.Item>
              )
            }
          </For>
          <Pagination.Item type="trigger">
            <Pagination.Next />
          </Pagination.Item>
        </Pagination.List>
      )}
    </Pagination.Root>
  )
}
