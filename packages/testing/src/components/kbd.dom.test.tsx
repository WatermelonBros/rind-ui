// Kbd through its driver (spec kbd): nested kbd elements, the platform's form (Apple glyphs,
// words elsewhere), glyphs named for screen readers, sequences, the override, free children,
// and aria-keyshortcuts from the same keys.
import { keyShortcuts } from "@rind-ui/core"
import { Kbd, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { computeAccessibleName } from "dom-accessibility-api"
import { describe, expect, it } from "vitest"
import { getKbd } from "../index"

const APPLE = { apple: true, mac: true } as const
const WINDOWS = { apple: false, windows: true } as const

/** The Kbd inside a button: a kbd has no name of its own, the button's name says it. */
function setup(node: React.ReactNode, platform: Record<string, boolean> = WINDOWS) {
  const { container } = render(
    <RindProvider environment={{ platform: platform as never }}>
      <button type="button">{node}</button>
    </RindProvider>,
  )
  const spoken = () => computeAccessibleName(screen.getByRole("button"))
  return { d: getKbd(container), container, spoken }
}

describe("kbd", () => {
  it("a kbd of nested kbd keys; words with + elsewhere", async () => {
    const { d, container, spoken } = setup(<Kbd.Root keys="ctrl+k" />)
    const root = container.querySelector('kbd[data-part="root"]') as HTMLElement
    expect(root.getAttribute("dir")).toBe("ltr")
    expect([...root.querySelectorAll("kbd")].map((k) => k.textContent)).toEqual([
      "CtrlControl",
      "K",
    ])
    expect(await d.keys()).toEqual(["ctrl", "k"])
    expect(spoken()).toBe("Control plus K")
    expect(await d.platform()).toBe("other")
  })

  it("Apple: glyphs without separators, each named", async () => {
    const { d, spoken } = setup(<Kbd.Root keys="mod+shift+p" />, APPLE)
    expect(await d.platform()).toBe("apple")
    expect(await d.keys()).toEqual(["meta", "shift", "p"])
    expect(spoken()).toBe("Command plus Shift plus P")
    const visible = [
      ...document.querySelectorAll(
        '[data-part="key"] > [aria-hidden], [data-part="key"] > span:only-child',
      ),
    ]
      .map((s) => s.textContent)
      .join("")
    expect(visible).toBe("⌘⇧P")
  })

  it("a sequence says then", () => {
    const { spoken } = setup(<Kbd.Root keys="g i" />)
    expect(spoken()).toBe("G then I")
  })

  it("the platform prop overrides the environment", async () => {
    const { d } = setup(<Kbd.Root keys="mod+k" platform="apple" />)
    expect(await d.keys()).toEqual(["meta", "k"])
  })

  it("children render as written", () => {
    setup(<Kbd.Root>Esc</Kbd.Root>)
    expect(screen.getByText("Esc").tagName).toBe("KBD")
  })

  it("aria-keyshortcuts from the same keys (React Spectrum #6478)", () => {
    render(
      <button type="button" aria-keyshortcuts={keyShortcuts("mod+s", false)}>
        Save <Kbd.Root keys="mod+s" platform="other" />
      </button>,
    )
    expect(screen.getByRole("button").getAttribute("aria-keyshortcuts")).toBe("Control+S")
  })
})
