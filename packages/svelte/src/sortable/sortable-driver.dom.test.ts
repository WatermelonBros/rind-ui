// Sortable through its driver against the Svelte parts (React's DOM tests): handles named for
// their items, keyboard moves with focus kept, Escape restores, Home / End, Alt+arrow and move
// buttons, disabled items, the source removed mid-session, a press elsewhere drops, horizontal
// orientation, and a pointer drag (browser).
import { getSortable, recordingAnnouncer } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import Fruits from "../../fixtures/sortable/fruits.svelte"

const browser = !navigator.userAgent.includes("jsdom")

async function setup(props: Record<string, unknown> = {}) {
  const rec = recordingAnnouncer()
  const rendered = mount(Fruits, { ...props, announcer: rec.announcer } as never)
  return {
    d: getSortable(screen, { name: "Fruits" }),
    said: () => rec.log.map((a) => a.message),
    rerender: (next: Record<string, unknown>) => rendered.rerender(next as never),
  }
}
const handle = (label: string) => screen.getByRole("button", { name: `Reorder ${label}` })

describe("svelte sortable", () => {
  it("each handle is a button named for its item, with instructions", async () => {
    await setup()
    const el = handle("Apple")
    expect(el.getAttribute("aria-pressed")).toBe("false")
    const ins = document.getElementById(el.getAttribute("aria-describedby") ?? "")
    expect(ins?.textContent).toMatch(/Space to pick up/)
  })

  it("keyboard moves by position and keeps focus on the handle (dnd-kit #2106)", async () => {
    const user = userEvent.setup()
    const { d, said } = await setup()
    handle("Apple").focus()
    await user.keyboard(" ")
    expect(handle("Apple").getAttribute("aria-pressed")).toBe("true")
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(await d.order()).toEqual(["banana", "cherry", "apple"])
    expect(document.activeElement).toBe(handle("Apple"))
    // Still picked up after the moves (the item moved in the DOM).
    expect(handle("Apple").getAttribute("aria-pressed")).toBe("true")
    expect(said().at(-1)).toBe("Position 3 of 3")
    await user.keyboard(" ")
    expect(said().at(-1)).toBe("Apple dropped at position 3 of 3")
    expect(handle("Apple").getAttribute("aria-pressed")).toBe("false")
  })

  it("Escape restores the order from the pick-up", async () => {
    const user = userEvent.setup()
    const { d } = await setup()
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}{ArrowDown}{Escape}")
    expect(await d.order()).toEqual(["apple", "banana", "cherry"])
  })

  it("Home and End", async () => {
    const user = userEvent.setup()
    const { d } = await setup()
    handle("Apple").focus()
    await user.keyboard(" {End} ")
    expect(await d.order()).toEqual(["banana", "cherry", "apple"])
  })

  it("Alt+arrow and the move buttons move one place (WCAG 2.5.7)", async () => {
    const { d } = await setup({ buttons: true })
    await d.via("keyboard").quickMove("Apple", 1)
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
    await d.via("pointer").quickMove("Cherry", -1)
    expect(await d.order()).toEqual(["banana", "cherry", "apple"])
    expect(
      screen.getByRole("button", { name: "Move Banana up" }).getAttribute("aria-disabled"),
    ).toBe("true")
  })

  it("a disabled item is not picked up but can be passed", async () => {
    const user = userEvent.setup()
    const { d } = await setup({ disabled: ["banana"] })
    handle("Banana").focus()
    await user.keyboard(" ")
    expect(handle("Banana").getAttribute("aria-pressed")).toBe("false")
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown} ")
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("the picked-up item removed from items ends the session (React Aria #10599)", async () => {
    const user = userEvent.setup()
    const { d, rerender } = await setup()
    handle("Apple").focus()
    await user.keyboard(" ")
    await rerender({ hide: "apple" })
    expect(await d.active()).toBe("")
    expect(await d.pressed()).toBe(false)
  })

  it("a press elsewhere drops", async () => {
    const user = userEvent.setup()
    const { d } = await setup()
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}")
    await user.click(screen.getByRole("button", { name: "Elsewhere" }))
    expect(await d.pressed()).toBe(false)
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("horizontal: Left / Right move", async () => {
    const user = userEvent.setup()
    const { d } = await setup({ orientation: "horizontal" })
    handle("Cherry").focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(await d.order()).toEqual(["apple", "cherry", "banana"])
  })

  it.runIf(browser)("a pointer drag reorders once, on drop", async () => {
    const reorders: string[][] = []
    const { d } = await setup({ onReorder: (keys: readonly string[]) => reorders.push([...keys]) })
    await d.drag("Apple", 2)
    expect(reorders).toEqual([["banana", "cherry", "apple"]])
  })
})
