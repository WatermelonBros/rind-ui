// Deliberately broken listboxes (add-collections 7.5): each must fail testMachine with a report
// that names the broken invariant, and the healthy fixture must pass the same configuration.
import { type AnyContract, platforms } from "@rind-ui/core"
import { RindProvider } from "@rind-ui/react"
import { cleanup, render, screen } from "@testing-library/react"
import { type ReactElement, type ReactNode, useEffect, useRef } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { currentRun, testMachine } from "../../src/index"
import { listboxIds } from "./listbox.connect"
import { changedCollection, listboxContract } from "./listbox.contract"
import { FRUITS, ListboxExample } from "./listbox.fixture"
import { fromData } from "./listbox.react"

const AsRun = ({ children }: { children: ReactNode }) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {children}
  </RindProvider>
)

const initial = fromData(FRUITS)
// A collection change that removes the first item.
const first = initial.firstKey()
const changed = first === null ? initial : initial.remove(first)

type Collection = typeof initial
type Ui = (collection: Collection) => ReactElement

/** Runs testMachine with a collecting registrar; returns each test's name and failure. */
async function failuresOf(c: AnyContract, ui: Ui) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(c, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(ui(initial), { wrapper: AsRun }),
    target: () => screen,
    // AnyContract erases the anchor and props types; the real contract is listboxContract.
    anchor: ["Fruit"] as never,
    rerender: (props, rendered) =>
      rendered.rerender(ui((props as { collection: Collection }).collection)),
    props: {
      collection: initial,
      ids: listboxIds("oracle"),
      strategy: "roving",
      selectionMode: "multiple",
      // The selected item takes the initial highlight: cherry, not the first item, so a reset
      // to the first item after the collection change is observable.
      defaultValue: ["cherry"],
    },
    modalities: ["pointer", "keyboard"],
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    cleanup()
    out.push({ name: t.name, error })
  }
  return out
}
const errors = (r: { error: string | null }[]) => r.flatMap((x) => (x.error ? [x.error] : []))

const healthy: Ui = (collection) => (
  <ListboxExample collection={collection} selectionMode="multiple" defaultValue={["cherry"]} />
)

beforeEach(() => {
  changedCollection.current = changed
})

describe("listbox: healthy and broken variants", () => {
  it("the healthy fixture passes the same configuration", { timeout: 120_000 }, async () => {
    const results = await failuresOf(listboxContract, healthy)
    expect(errors(results)).toEqual([])
    expect(results.length).toBeGreaterThan(0)
  })

  it("highlight reset on every collection change → collection repair", {
    timeout: 120_000,
  }, async () => {
    // Broken: on every collection change focus (hence the highlight) jumps to the first item,
    // where the spec moves it to the next surviving one.
    function ResetToFirst({
      collection,
      children,
    }: {
      collection: Collection
      children: ReactNode
    }) {
      const ref = useRef<HTMLDivElement>(null)
      // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each new collection by design
      useEffect(() => {
        const root = ref.current
        if (!root?.contains(document.activeElement)) return
        root.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])')?.focus()
      }, [collection])
      return <div ref={ref}>{children}</div>
    }
    const resetting: Ui = (collection) => (
      <ResetToFirst collection={collection}>
        <ListboxExample
          collection={collection}
          selectionMode="multiple"
          defaultValue={["cherry"]}
        />
      </ResetToFirst>
    )
    const found = errors(await failuresOf(listboxContract, resetting))
    expect(found.length).toBeGreaterThan(0)
    expect(found.some((e) => e.includes("the highlighted item is"))).toBe(true)
    expect(found.some((e) => e.includes("$props:collection"))).toBe(true)
  })

  it("aria-selected on the highlighted option → selectable", { timeout: 120_000 }, async () => {
    function Mirror({ children }: { children: ReactNode }) {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const root = ref.current
        if (!root) return
        // Broken: aria-selected follows data-highlighted instead of the selection.
        const sync = () => {
          for (const o of root.querySelectorAll('[role="option"]')) {
            const lit = String(o.hasAttribute("data-highlighted"))
            if (o.getAttribute("aria-selected") !== lit) o.setAttribute("aria-selected", lit)
          }
        }
        sync()
        const observer = new MutationObserver(sync)
        observer.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-highlighted", "aria-selected"],
        })
        return () => observer.disconnect()
      }, [])
      return <div ref={ref}>{children}</div>
    }
    const mirrored: Ui = (collection) => (
      <Mirror>
        <ListboxExample
          collection={collection}
          selectionMode="multiple"
          defaultValue={["cherry"]}
        />
      </Mirror>
    )
    const found = errors(await failuresOf(listboxContract, mirrored))
    expect(found.length).toBeGreaterThan(0)
    expect(found.some((e) => e.includes("differ from the machine's value"))).toBe(true)
  })
})
