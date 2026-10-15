// The listbox fixture's driver test: unchanged in jsdom and the browser, both strategies.

import { platforms } from "@rind-ui/core"
import { RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { createDriver } from "../../src/index"
import { listboxContract } from "./listbox.contract"
import { ListboxExample } from "./listbox.fixture"

// The driver presses `mod` as Linux by default (Control): the page must agree, whatever the host.
const onLinux = (ui: ReactElement) => (
  <RindProvider environment={{ platform: platforms.linux }}>{ui}</RindProvider>
)

describe.each(["roving", "active-descendant"] as const)("listbox (%s)", (strategy) => {
  it("highlights, chooses, extends a range and typeaheads by keyboard", async () => {
    render(
      <ListboxExample strategy={strategy} selectionMode="multiple" selectionBehavior="replace" />,
    )
    const lb = createDriver(listboxContract, screen, "Fruit").via("keyboard")
    expect(await lb.items()).toEqual(["Apple", "Banana", "Cherry", "Date", "Elderberry"])
    await lb.highlight("Cherry")
    expect(await lb.highlighted()).toBe("Cherry")
    expect(await lb.focusedItem()).toBe("Cherry")
    await lb.choose("Banana")
    expect(await lb.selected()).toEqual(["Banana"])
    await lb.chooseRange("Banana", "Date")
    expect(await lb.selected()).toEqual(["Banana", "Cherry", "Date"])
    await lb.typeahead("e")
    expect(await lb.highlighted()).toBe("Elderberry")
  })

  it("chooses by pointer", async () => {
    render(<ListboxExample strategy={strategy} selectionMode="single" />)
    const lb = createDriver(listboxContract, screen, "Fruit").via("pointer")
    await lb.choose("Date")
    expect(await lb.selected()).toEqual(["Date"])
    await lb.choose("Apple")
    expect(await lb.selected()).toEqual(["Apple"])
  })

  it("chooses a range by pointer (click, then Shift+click)", async () => {
    render(
      <ListboxExample strategy={strategy} selectionMode="multiple" selectionBehavior="replace" />,
    )
    const lb = createDriver(listboxContract, screen, "Fruit").via("pointer")
    await lb.chooseRange("Banana", "Date")
    expect(await lb.selected()).toEqual(["Banana", "Cherry", "Date"])
  })

  it("toggles by pointer (mod+click adds, then removes) in a replace list", async () => {
    render(
      onLinux(
        <ListboxExample strategy={strategy} selectionMode="multiple" selectionBehavior="replace" />,
      ),
    )
    const lb = createDriver(listboxContract, screen, "Fruit").via("pointer")
    await lb.choose("Apple")
    await lb.toggle("Cherry")
    expect(await lb.selected()).toEqual(["Apple", "Cherry"])
    await lb.toggle("Cherry")
    expect(await lb.selected()).toEqual(["Apple"])
  })

  it("selectAll twice by keyboard: everything, then nothing", async () => {
    render(onLinux(<ListboxExample strategy={strategy} selectionMode="multiple" />))
    const lb = createDriver(listboxContract, screen, "Fruit").via("keyboard")
    await lb.selectAll()
    expect(await lb.selected()).toEqual(["Apple", "Banana", "Cherry", "Date", "Elderberry"])
    await lb.selectAll()
    expect(await lb.selected()).toEqual([])
  })

  it("typeahead with no match resolves and leaves the highlight unchanged", async () => {
    render(<ListboxExample strategy={strategy} selectionMode="single" />)
    const lb = createDriver(listboxContract, screen, "Fruit").via("keyboard")
    await lb.highlight("Cherry")
    await lb.typeahead("zz")
    expect(await lb.highlighted()).toBe("Cherry")
  })
})
