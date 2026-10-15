// Separator scenarios through the separator driver (openspec separator). Runs in jsdom and in
// real browsers; the axe cases cover content, a toolbar, a menu and a listbox popup.
import { Separator, SeparatorHostContext } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { getSeparator } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("getSeparator", () => {
  it("finds a named separator by role and name", async () => {
    render(<Separator.Root aria-label="Advanced settings" orientation="vertical" />)
    const s = getSeparator(screen, { name: "Advanced settings" })
    expect(await s.orientation()).toBe("vertical")
    expect(await s.isDecorative()).toBe(false)
    expect(await s.isExposed()).toBe(true)
  })

  it("finds the one inside `within`", async () => {
    render(
      <>
        <div role="toolbar" aria-label="Tools" data-testid="bar">
          <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
            <Separator.Root />
          </SeparatorHostContext>
        </div>
        <Separator.Root />
      </>,
    )
    const s = getSeparator(screen, { within: screen.getByTestId("bar") })
    expect(await s.orientation()).toBe("vertical")
    expect(await s.isDecorative()).toBe(false)
  })

  it("decorative: not exposed", async () => {
    render(
      <div data-testid="box">
        <Separator.Root decorative />
      </div>,
    )
    const s = getSeparator(screen, { within: screen.getByTestId("box") })
    expect(await s.orientation()).toBe("horizontal")
    expect(await s.isDecorative()).toBe(true)
    expect(await s.isExposed()).toBe(false)
  })

  it("an hr is exposed", async () => {
    render(
      <div data-testid="box">
        <Separator.Root render={<hr />} />
      </div>,
    )
    expect(await getSeparator(screen, { within: screen.getByTestId("box") }).isExposed()).toBe(true)
  })

  it("several matches inside within fail listing every match", async () => {
    render(
      <div data-testid="box">
        <Separator.Root />
        <Separator.Root />
      </div>,
    )
    await expect(
      getSeparator(screen, { within: screen.getByTestId("box") }).orientation(),
    ).rejects.toThrow(/2 elements match/)
  })

  it("fails when nothing matches", async () => {
    render(<Separator.Root aria-label="One" />)
    await expect(getSeparator(screen, { name: "Nope" }).orientation()).rejects.toThrow()
  })
})

describe("Accessibility (axe)", () => {
  it("in content", async () => {
    render(
      <main>
        <p>One</p>
        <Separator.Root />
        <p>Two</p>
        <Separator.Root decorative />
        <Separator.Root render={<hr />} />
      </main>,
    )
    await a11y()
  })

  it("in a toolbar-like row", async () => {
    render(
      <div role="toolbar" aria-label="Format">
        <button type="button">Bold</button>
        <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
          <Separator.Root />
        </SeparatorHostContext>
        <button type="button">Italic</button>
      </div>,
    )
    await a11y()
    expect(document.querySelector('[role="separator"]')?.getAttribute("aria-orientation")).toBe(
      "vertical",
    )
  })

  it("in a menu", async () => {
    render(
      <div role="menu" aria-label="Actions">
        <div role="menuitem" tabIndex={-1}>
          Cut
        </div>
        <SeparatorHostContext value={{ context: "menu" }}>
          <Separator.Root />
        </SeparatorHostContext>
        <div role="menuitem" tabIndex={-1}>
          Paste
        </div>
      </div>,
    )
    await a11y()
  })

  it("in a listbox popup: role none keeps aria-required-children passing", async () => {
    render(
      <div role="listbox" aria-label="Fruit">
        <div role="option" aria-selected="false" tabIndex={-1}>
          Apple
        </div>
        <SeparatorHostContext value={{ context: "listbox" }}>
          <Separator.Root />
        </SeparatorHostContext>
        <div role="option" aria-selected="false" tabIndex={-1}>
          Pear
        </div>
      </div>,
    )
    expect(document.querySelector('[data-scope="separator"]')?.getAttribute("role")).toBe("none")
    await a11y()
  })
})
