// Sortable through its driver (spec sortable): handles named for their items, keyboard moves
// by position with focus kept, Escape restores, Home / End, Alt+arrow and move buttons,
// announcements from the current order, disabled items, the source removed mid-session, a press
// elsewhere drops, horizontal orientation, and a pointer drag (browser).
import { RindProvider, Sortable, type SortableRootProps } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { getSortable, recordingAnnouncer } from "../index"

const browser = !navigator.userAgent.includes("jsdom")
const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }

function Fruits({
  initial = ["apple", "banana", "cherry"],
  disabled = [],
  hide,
  buttons = false,
  ...props
}: Partial<SortableRootProps> & {
  readonly initial?: readonly string[]
  readonly disabled?: readonly string[]
  readonly hide?: string
  readonly buttons?: boolean
}) {
  const [items, setItems] = useState<readonly string[]>(initial)
  const shown = items.filter((k) => k !== hide)
  return (
    <>
      <Sortable.Root
        aria-label="Fruits"
        items={shown}
        onReorder={(keys) => setItems(keys)}
        {...props}
      >
        {shown.map((k) => (
          <Sortable.Item key={k} value={k} disabled={disabled.includes(k)} style={{ height: 40 }}>
            <Sortable.Handle />
            <span>{LABELS[k]}</span>
            {buttons ? (
              <>
                <Sortable.MoveButton direction="up" />
                <Sortable.MoveButton direction="down" />
              </>
            ) : null}
          </Sortable.Item>
        ))}
        <Sortable.Indicator />
      </Sortable.Root>
      <button type="button">Elsewhere</button>
    </>
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  const result = render(<RindProvider announcer={rec.announcer}>{node}</RindProvider>)
  return {
    d: getSortable(screen, { name: "Fruits" }),
    said: () => rec.log.map((a) => a.message),
    ...result,
  }
}

const handle = (label: string) => screen.getByRole("button", { name: `Reorder ${label}` })

describe("sortable", () => {
  it("each handle is a button named for its item, with instructions", () => {
    setup(<Fruits />)
    const h = handle("Apple")
    expect(h.getAttribute("aria-pressed")).toBe("false")
    const ins = document.getElementById(h.getAttribute("aria-describedby") ?? "")
    expect(ins?.textContent).toMatch(/Space to pick up/)
  })

  it("keyboard moves by position and keeps focus on the handle (dnd-kit #2106)", async () => {
    const user = userEvent.setup()
    const { d, said } = setup(<Fruits />)
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
    const { d } = setup(<Fruits />)
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}{ArrowDown}{Escape}")
    expect(await d.order()).toEqual(["apple", "banana", "cherry"])
  })

  it("Home and End", async () => {
    const user = userEvent.setup()
    const { d } = setup(<Fruits />)
    handle("Apple").focus()
    await user.keyboard(" {End} ")
    expect(await d.order()).toEqual(["banana", "cherry", "apple"])
  })

  it("Alt+arrow and the move buttons move one place (WCAG 2.5.7)", async () => {
    const { d } = setup(<Fruits buttons />)
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
    const { d } = setup(<Fruits disabled={["banana"]} />)
    handle("Banana").focus()
    await user.keyboard(" ")
    expect(handle("Banana").getAttribute("aria-pressed")).toBe("false")
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown} ")
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("the picked-up item removed from items ends the session (React Aria #10599)", async () => {
    const user = userEvent.setup()
    function Host() {
      const [hide, setHide] = useState<string | undefined>(undefined)
      return (
        <>
          <Fruits {...(hide === undefined ? {} : { hide })} />
          <button type="button" onClick={() => setHide("apple")}>
            Remove apple
          </button>
        </>
      )
    }
    const { d } = setup(<Host />)
    handle("Apple").focus()
    await user.keyboard(" ")
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Remove apple" }))
    })
    expect(await d.active()).toBe("")
    expect(await d.pressed()).toBe(false)
  })

  it("a press elsewhere drops", async () => {
    const user = userEvent.setup()
    const { d } = setup(<Fruits />)
    handle("Apple").focus()
    await user.keyboard(" {ArrowDown}")
    await user.click(screen.getByRole("button", { name: "Elsewhere" }))
    expect(await d.pressed()).toBe(false)
    expect(await d.order()).toEqual(["banana", "apple", "cherry"])
  })

  it("horizontal: Left / Right move", async () => {
    const user = userEvent.setup()
    const { d } = setup(<Fruits orientation="horizontal" />)
    handle("Cherry").focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(await d.order()).toEqual(["apple", "cherry", "banana"])
  })

  it.runIf(browser)("a pointer drag reorders once, on drop", async () => {
    const reorders: string[][] = []
    function Spy() {
      const [items, setItems] = useState<readonly string[]>(["apple", "banana", "cherry"])
      return (
        <Sortable.Root
          aria-label="Fruits"
          items={items}
          onReorder={(keys) => {
            reorders.push([...keys])
            setItems(keys)
          }}
        >
          {items.map((k) => (
            <Sortable.Item key={k} value={k} style={{ height: 40, listStyle: "none" }}>
              <Sortable.Handle style={{ width: 24, height: 24 }} />
              {LABELS[k]}
            </Sortable.Item>
          ))}
          <Sortable.Indicator />
        </Sortable.Root>
      )
    }
    const { d } = setup(<Spy />)
    await d.drag("Apple", 2)
    expect(reorders).toEqual([["banana", "cherry", "apple"]])
  })
})
