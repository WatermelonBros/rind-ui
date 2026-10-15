import type { Collection, ItemRegistry, RegisteredItem } from "@rind-ui/core"
import { createListCollection } from "@rind-ui/core"
import { act, render } from "@testing-library/react"
import { createContext, useContext, useMemo, useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  useCollectionIdentityWarning,
  useCollectionItems,
  useRegisterItem,
} from "./use-collection-items"

const RegistryContext = createContext<ItemRegistry | null>(null)

function Item({ id, disabled }: { id: string; disabled?: boolean }) {
  const ref = useRef<HTMLLIElement | null>(null)
  useRegisterItem(useContext(RegistryContext), { key: id, disabled }, ref)
  return <li ref={ref}>{id}</li>
}

/** Renders the items and reports every collection the root receives. */
function Root({ ids, seen }: { ids: string[]; seen: (Collection<RegisteredItem> | null)[] }) {
  const { collection, registry } = useCollectionItems()
  seen.push(collection)
  return (
    <RegistryContext.Provider value={registry}>
      <ul>
        {ids.map((id) => (
          <Item key={id} id={id} />
        ))}
      </ul>
    </RegistryContext.Provider>
  )
}

const keysOf = (c: Collection<unknown> | null | undefined) =>
  c ? Array.from({ length: c.size }, (_, i) => c.at(i)?.key) : null
const last = <T,>(a: readonly T[]): T | undefined => a[a.length - 1]

afterEach(() => vi.restoreAllMocks())

describe("useCollectionItems", () => {
  it("static parts become one collection per commit", async () => {
    const seen: (Collection<RegisteredItem> | null)[] = []
    await act(async () => {
      render(<Root ids={["a", "b", "c"]} seen={seen} />)
    })
    // First render is null (server render / first paint); then exactly one collection.
    expect(seen[0]).toBeNull()
    const instances = new Set(seen.filter((c) => c !== null))
    expect(instances.size).toBe(1)
    expect(keysOf(last(seen))).toEqual(["a", "b", "c"])
    expect(last(seen)?.at(0)?.textValue).toBe("a")
  })

  it("keeps the same instance when nothing changed", async () => {
    const seen: (Collection<RegisteredItem> | null)[] = []
    const view = render(<Root ids={["a", "b"]} seen={seen} />)
    await act(async () => {})
    const first = last(seen)
    await act(async () => view.rerender(<Root ids={["a", "b"]} seen={seen} />))
    expect(last(seen)).toBe(first)
  })

  it("an item inserted before the others reorders the collection", async () => {
    const seen: (Collection<RegisteredItem> | null)[] = []
    const view = render(<Root ids={["a", "b", "c"]} seen={seen} />)
    await act(async () => {})
    await act(async () => view.rerender(<Root ids={["z", "a", "b", "c"]} seen={seen} />))
    expect(keysOf(last(seen))).toEqual(["z", "a", "b", "c"])
  })

  it("removing an item unregisters it", async () => {
    const seen: (Collection<RegisteredItem> | null)[] = []
    const view = render(<Root ids={["a", "b", "c"]} seen={seen} />)
    await act(async () => {})
    await act(async () => view.rerender(<Root ids={["a", "c"]} seen={seen} />))
    expect(keysOf(last(seen))).toEqual(["a", "c"])
  })
})

describe("useCollectionIdentityWarning", () => {
  const make = (n: number) =>
    createListCollection({
      items: ["a", "b", "c"],
      getKey: (s) => s,
      getText: (s) => `${s}${n}`,
    })
  function Watch({ n, memo }: { n: number; memo?: boolean }) {
    const memoised = useMemo(() => make(0), [])
    const collection = memo ? memoised : make(n)
    useCollectionIdentityWarning(collection, "Listbox")
    return null
  }

  it("warns once after 10 commits with a new instance but equal keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const view = render(<Watch n={0} />)
    for (let n = 1; n <= 9; n++) view.rerender(<Watch n={n} />)
    expect(warn).not.toHaveBeenCalled()
    view.rerender(<Watch n={10} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("Listbox")
    for (let n = 11; n <= 15; n++) view.rerender(<Watch n={n} />)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("does not warn when the collection is memoised", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const view = render(<Watch n={0} memo />)
    for (let n = 1; n <= 20; n++) view.rerender(<Watch n={n} memo />)
    expect(warn).not.toHaveBeenCalled()
  })
})
