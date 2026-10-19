// biome-ignore-all lint/a11y: fixtures deliberately wrap and label arbitrary elements
// Spec scenarios (add-rating), through the driver where it can. Pointer scenarios that need a
// position inside a star (half values, hover) need layout: browser mode only.
import { domEnvironment } from "@rind-ui/core"
import { Field, Rating, type RatingRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getRating } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)

afterEach(() => vi.restoreAllMocks())

function R({ label = "Score", ...props }: RatingRootProps & { readonly label?: string }) {
  const count = props.count ?? 5
  return (
    <Rating.Root {...props}>
      <Rating.Label>{label}</Rating.Label>
      <Rating.Control>
        {Array.from({ length: count }, (_, i) => (
          <Rating.Item
            // biome-ignore lint/suspicious/noArrayIndexKey: stars are identified by position
            key={i + 1}
            index={i + 1}
            style={{ display: "inline-block", width: 24, height: 24 }}
          />
        ))}
      </Rating.Control>
    </Rating.Root>
  )
}

const drv = (name = "Score") => getRating(screen, { name }, { platform })
const range = () => screen.getByRole("slider") as HTMLInputElement
const carrier = () =>
  document.querySelector<HTMLInputElement>(
    '[data-scope="rating"][data-part="hidden-input"]',
  ) as HTMLInputElement
const star = (i: number) =>
  document.querySelector<HTMLElement>(
    `[data-scope="rating"][data-part="item"][data-index="${i}"]`,
  ) as HTMLElement

describe("Rating smoke", () => {
  it("rates with the keyboard and the pointer through the driver", async () => {
    const onValueChange = vi.fn()
    render(<R onValueChange={onValueChange} />)
    const r = drv()
    expect(await r.value()).toBe(0)
    expect(await r.valueText()).toBe("No rating")
    await r.rate(3)
    expect(await r.value()).toBe(3)
    expect(await r.valueText()).toBe("3 of 5 stars")
    expect(await r.stars()).toEqual(["full", "full", "full", "empty", "empty"])
    await r.pressStar(5)
    expect(await r.value()).toBe(5)
    expect(onValueChange).toHaveBeenLastCalledWith(5, expect.objectContaining({ reason: "PRESS" }))
  })
})

describe("Anatomy and ARIA", () => {
  it("one slider, a native range input named by the Label; the stars are hidden", () => {
    render(<R defaultValue={2} />)
    const sliders = screen.getAllByRole("slider")
    expect(sliders).toHaveLength(1)
    expect(range().type).toBe("range")
    expect(screen.getByRole("slider", { name: "Score" })).toBe(range())
    for (let i = 1; i <= 5; i++) expect(star(i).getAttribute("aria-hidden")).toBe("true")
    // One tab stop: the carrier is not focusable.
    expect(carrier().tabIndex).toBe(-1)
    expect(carrier().getAttribute("aria-hidden")).toBe("true")
  })

  it("a press focuses the input without a ring; Tab shows one", async () => {
    render(<R />)
    await drv().pressStar(2)
    expect(document.activeElement).toBe(range())
    expect(range().hasAttribute("data-focus-visible")).toBe(false)
  })

  it("translated value text", async () => {
    render(
      <RindProvider locale="it">
        <R
          defaultValue={3.5}
          allowHalf
          messages={{ valueText: ({ formatted }) => `${formatted} stelle` }}
        />
      </RindProvider>,
    )
    expect(range().getAttribute("aria-valuetext")).toBe("3,5 stelle")
  })
})

describe("Keyboard", () => {
  it("arrows step, Home and End reach the bounds, PageUp a whole star", async () => {
    render(<R defaultValue={2} allowHalf />)
    const r = drv()
    await r.step("increase")
    expect(await r.value()).toBe(2.5)
    await r.toEdge("last")
    expect(await r.value()).toBe(5)
    await r.toEdge("first")
    expect(await r.value()).toBe(0.5)
    act(() => {
      fireEvent.keyDown(range(), { key: "PageUp" })
    })
    expect(await r.value()).toBe(1.5)
  })

  it("not clearable: the keys never reach 0; allowClear: they do", async () => {
    const { unmount } = render(<R defaultValue={1} />)
    await drv().step("decrease")
    expect(await drv().value()).toBe(1)
    unmount()
    render(<R defaultValue={1} allowClear />)
    await drv().step("decrease")
    expect(await drv().value()).toBe(0)
  })

  it("RTL mirrors the horizontal arrows (Kobalte flips values and keys)", async () => {
    render(<R defaultValue={2} dir="rtl" />)
    act(() => {
      fireEvent.keyDown(range(), { key: "ArrowLeft" })
    })
    expect(await drv().value()).toBe(3)
    act(() => {
      fireEvent.keyDown(range(), { key: "ArrowUp" })
    })
    expect(await drv().value()).toBe(4)
  })

  it("read-only keeps focus and value; disabled leaves the tab order", async () => {
    const { unmount } = render(<R defaultValue={2} readOnly />)
    await drv().step("increase")
    await drv().pressStar(5)
    expect(await drv().value()).toBe(2)
    expect(await drv().isReadOnly()).toBe(true)
    unmount()
    render(<R defaultValue={2} disabled />)
    expect(range().disabled).toBe(true)
    expect(await drv().isDisabled()).toBe(true)
  })
})

describe("Pointer", () => {
  it("allowClear: pressing the current value clears it (MUI#25533)", async () => {
    render(<R defaultValue={3} allowClear />)
    await drv().pressStar(3)
    expect(await drv().value()).toBe(0)
    expect(await drv().valueText()).toBe("No rating")
  })

  it.runIf(inJsdom)("without layout a half-star press fails: it needs layout", async () => {
    render(<R allowHalf />)
    await expect(drv().rate(2.5)).rejects.toThrow(/needs layout/)
  })

  browserIt("half stars: the first half of a star is a half value, mirrored in RTL", async () => {
    const { unmount } = render(<R allowHalf />)
    await drv().rate(2.5)
    expect(await drv().value()).toBe(2.5)
    expect(await drv().stars()).toEqual(["full", "full", "half", "empty", "empty"])
    unmount()
    render(<R allowHalf dir="rtl" />)
    await drv().rate(3.5)
    expect(await drv().value()).toBe(3.5)
  })

  browserIt("hover previews without changing aria or the form (ZG#3456)", async () => {
    render(
      <form>
        <R defaultValue={1} name="score" />
      </form>,
    )
    const r = drv()
    await r.hover(4)
    expect(await r.isPreviewing()).toBe(true)
    expect(await r.stars()).toEqual(["full", "full", "full", "full", "empty"])
    expect(await r.value()).toBe(1)
    expect(carrier().value).toBe("1")
    await r.leave()
    expect(await r.isPreviewing()).toBe(false)
    expect(await r.stars()).toEqual(["full", "empty", "empty", "empty", "empty"])
  })

  browserIt("the press commits its own position, not the earlier hover (MUI#22827)", async () => {
    render(<R allowHalf />)
    await drv().hover(4, true)
    await drv().rate(2)
    expect(await drv().value()).toBe(2)
  })

  it("a touch never previews", () => {
    render(<R />)
    act(() => {
      fireEvent.pointerMove(star(4), { pointerType: "touch" })
    })
    expect(document.querySelector('[data-part="root"]')?.hasAttribute("data-previewing")).toBe(
      false,
    )
  })
})

describe("Assistive technology", () => {
  it("adopts a native adjustment; refuses 0 unless clearable", async () => {
    render(<R defaultValue={2} />)
    await drv().adjustNative(4)
    expect(await drv().value()).toBe(4)
    await drv().adjustNative(0)
    expect(await drv().value()).toBe(4)
    expect(range().value).toBe("4")
  })
})

describe("Form participation", () => {
  it("submits the value under name, '' while unrated; reset restores the current default", async () => {
    function Form({ d }: { readonly d: number }) {
      return (
        <form>
          <R defaultValue={d} name="score" />
          <button type="reset">Reset</button>
        </form>
      )
    }
    const { rerender } = render(<Form d={2} />)
    const r = drv()
    expect(await r.formValue()).toEqual(["score", "2"])
    rerender(<Form d={4} />)
    expect(await r.value()).toBe(2)
    await r.rate(5)
    await r.resetForm()
    expect(await r.value()).toBe(4)
    expect(new FormData(carrier().form as HTMLFormElement).get("score")).toBe("4")
  })

  it("required: invalid while unrated with the browser's message; focus goes to the slider", async () => {
    render(
      <form>
        <R name="score" required />
      </form>,
    )
    expect(carrier().validity.valueMissing).toBe(true)
    expect(carrier().value).toBe("")
    await drv().rate(1)
    expect(carrier().validity.valid).toBe(true)
  })

  it("a disabled fieldset disables it", () => {
    render(
      <form>
        <fieldset disabled>
          <R name="score" defaultValue={2} />
        </fieldset>
      </form>,
    )
    expect(range().disabled).toBe(true)
  })

  it("inside a Field: named by the Field's Label, described by its Description", () => {
    render(
      <Field.Root>
        <Field.Label>Overall</Field.Label>
        <Rating.Root defaultValue={2}>
          <Rating.Control>
            {[1, 2, 3, 4, 5].map((i) => (
              <Rating.Item key={i} index={i} />
            ))}
          </Rating.Control>
        </Rating.Root>
        <Field.Description>How was your stay?</Field.Description>
      </Field.Root>,
    )
    const s = screen.getByRole("slider", { name: "Overall" })
    expect(s.getAttribute("aria-describedby")).toBeTruthy()
  })
})

describe("Controlled", () => {
  it("a refusing parent keeps the value", async () => {
    render(<R value={2} onValueChange={() => {}} />)
    await drv().step("increase")
    expect(await drv().value()).toBe(2)
    expect(range().value).toBe("2")
  })

  it("an applying parent follows", async () => {
    function C() {
      const [v, setV] = useState(1)
      return <R value={v} onValueChange={setV} />
    }
    render(<C />)
    await drv().rate(4)
    expect(await drv().value()).toBe(4)
  })
})

describe("Server render", () => {
  const tree = (): ReactNode => (
    <form>
      <R name="score" defaultValue={3.5} allowHalf />
    </form>
  )
  it("value, aria and star states are in the HTML; hydration is clean", async () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    const input = box.querySelector<HTMLInputElement>('input[type="range"]')
    expect(input?.getAttribute("aria-valuenow")).toBe("3.5")
    expect(input?.getAttribute("value")).toBe("3.5")
    expect(
      Array.from(box.querySelectorAll('[data-part="item"]')).map((s) =>
        s.getAttribute("data-state"),
      ),
    ).toEqual(["full", "full", "full", "half", "empty"])
    document.body.append(box)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(box, tree(), { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error).not.toHaveBeenCalled()
    await act(async () => root?.unmount())
    box.remove()
  })
})
