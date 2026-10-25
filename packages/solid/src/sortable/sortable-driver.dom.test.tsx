/** @jsxImportSource solid-js */
// Sortable through its driver against the Solid parts (React's DOM tests): handles named for
// their items, keyboard moves with focus kept, Escape restores, Home / End, Alt+arrow and move
// buttons, disabled items, the source removed mid-session, a press elsewhere drops, horizontal
// orientation, and a pointer drag (browser).
import { getSortable, recordingAnnouncer } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import { createSignal, For } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider, Sortable } from "../index"

const browser = !navigator.userAgent.includes("jsdom")
const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }

interface FruitsProps {
  readonly disabled?: readonly string[] | undefined
  readonly hide?: string | undefined
  readonly buttons?: boolean | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly onReorder?: ((keys: readonly string[]) => void) | undefined
}
function Fruits(props: FruitsProps) {
  const [items, setItems] = createSignal<readonly string[]>(["apple", "banana", "cherry"])
  const shown = () => items().filter((k) => k !== props.hide)
  return (
    <>
      <Sortable.Root
        aria-label="Fruits"
        items={shown()}
        orientation={props.orientation}
        onReorder={(keys) => {
          props.onReorder?.(keys)
          setItems(keys)
        }}
      >
        <For each={shown()}>
          {(k) => (
            <Sortable.Item
              value={k}
              disabled={props.disabled?.includes(k) === true}
              style={{ height: "40px" }}
            >
              <Sortable.Handle style={{ width: "24px", height: "24px" }} />
              <span>{LABELS[k]}</span>
              {props.buttons ? (
                <>
                  <Sortable.MoveButton direction="up" />
                  <Sortable.MoveButton direction="down" />
                </>
              ) : null}
            </Sortable.Item>
          )}
        </For>
        <Sortable.Indicator />
      </Sortable.Root>
      <button type="button">Elsewhere</button>
    </>
  )
}

function setup(props: FruitsProps = {}) {
  const rec = recordingAnnouncer()
  const rendered = mount(
    (p: FruitsProps) => (
      <RindProvider announcer={rec.announcer}>
        <Fruits
          disabled={p.disabled}
          hide={p.hide}
          buttons={p.buttons}
          orientation={p.orientation}
          onReorder={p.onReorder}
        />
      </RindProvider>
    ),
    props,
  )
  return {
    d: getSortable(screen, { name: "Fruits" }),
    said: () => rec.log.map((a) => a.message),
    rerender: rendered.rerender,
  }
}
const handle = (label: string) => screen.getByRole("button", { name: `Reorder ${label}` })

describe("solid sortable", () => {
  it("each handle is a button named for its item, with instructions", () => {
    setup()
    const el = handle("Apple")
    expect(el.getAttribute("aria-pressed")).toBe("false")
    const ins = document.getElementById(el.getAttribute("aria-describedby") ?? "")
    expect(ins?.textContent).toMatch(/Space to pick up/)
  })

  it("keyboard moves by position and keeps focus on the handle (dnd-kit #2106)", async () => {
    const user = userEvent.setup()
    const { d, said } = setup()
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
    const { d } = setup()
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}{ArrowDown}{Escape}")
    expect(await d.order()).toEqual(["apple", "banana", "cherry"])
  })

  it("Home and End", async () => {
    const user = userEvent.setup()
    const { d } = setup()
    handle("Apple").focus()
    await user.keyboard(" {End} ")
    expect(await d.order()).toEqual(["banana", "cherry", "apple"])
  })

  it("Alt+arrow and the move buttons move one place (WCAG 2.5.7)", async () => {
    const { d } = setup({ buttons: true })
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
    const { d } = setup({ disabled: ["banana"] })
    handle("Banana").focus()
    await user.keyboard(" ")
    expect(handle("Banana").getAttribute("aria-pressed")).toBe("false")
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown} ")
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("the picked-up item removed from items ends the session (React Aria #10599)", async () => {
    const user = userEvent.setup()
    const { d, rerender } = setup()
    handle("Apple").focus()
    await user.keyboard(" ")
    await rerender({ hide: "apple" })
    expect(await d.active()).toBe("")
    expect(await d.pressed()).toBe(false)
  })

  it("a press elsewhere drops", async () => {
    const user = userEvent.setup()
    const { d } = setup()
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}")
    await user.click(screen.getByRole("button", { name: "Elsewhere" }))
    expect(await d.pressed()).toBe(false)
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("horizontal: Left / Right move", async () => {
    const user = userEvent.setup()
    const { d } = setup({ orientation: "horizontal" })
    handle("Cherry").focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(await d.order()).toEqual(["apple", "cherry", "banana"])
  })

  it.runIf(browser)("a pointer drag reorders once, on drop", async () => {
    const reorders: string[][] = []
    const { d } = setup({ onReorder: (keys: readonly string[]) => reorders.push([...keys]) })
    await d.drag("Apple", 2)
    expect(reorders).toEqual([["banana", "cherry", "apple"]])
  })
})
