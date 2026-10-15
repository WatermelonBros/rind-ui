// A tap on an unhighlighted item focuses it; that highlight is a pointer one, so the list
// never scrolls to it (jsdom and browsers alike).
import { modalityTracker, platforms } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createDriver } from "../../src/index"
import { listboxContract } from "./listbox.contract"
import { Listbox, type ListboxItemData } from "./listbox.react"

const data: ListboxItemData[] = Array.from({ length: 30 }, (_, i) => ({
  key: `i${i + 1}`,
  label: `Item ${i + 1}`,
}))

const cleanup: (() => void)[] = []
const original = Element.prototype.scrollIntoView
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn()
  Element.prototype.scrollIntoView = original
})

// The fixture subscribes to the modality tracker only while the list element itself is
// focused, so on a first tap nothing has installed it yet and the modality reads "keyboard".
// Install it up front, as an app with a modality subscriber (a focus ring) would have.
function mount() {
  const unsubscribe = modalityTracker(
    () => document,
    () => platforms.linux,
  ).subscribe(() => {})
  cleanup.push(unsubscribe)
  // jsdom has no scrollIntoView: install the spy either way.
  const spy = vi.fn()
  Element.prototype.scrollIntoView = spy
  render(
    <Listbox.Root items={data} selectionMode="single">
      <Listbox.List aria-label="Items" style={{ height: 100, overflow: "auto" }}>
        <Listbox.Items />
      </Listbox.List>
    </Listbox.Root>,
  )
  return { spy, lb: createDriver(listboxContract, screen, "Items").via("touch") }
}

it("choosing a far item by touch never calls scrollIntoView", async () => {
  const { spy, lb } = mount()
  // The first tap enters the list (idle state: never scrolls); the second is the case that
  // used to scroll, with the list already focused.
  await lb.choose("Item 2")
  spy.mockClear()
  await lb.choose("Item 25")
  expect(await lb.selected()).toEqual(["Item 25"])
  expect(await lb.highlighted()).toBe("Item 25")
  expect(spy).not.toHaveBeenCalled()
})
