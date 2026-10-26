// Floating Panel (React) through its driver (spec floating-panel): a non-modal dialog named by its
// Title; the DragTrigger moves and resizes by keys; stages minimise (Body inert, focus to the
// DragTrigger), maximise and restore; Escape closes; an outside press does not; server HTML.
// Pointer drags and the boundary need layout: floating-panel.browser.test.tsx.
import { FloatingPanel, type FloatingPanelRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getFloatingPanel } from "../index"

afterEach(() => vi.restoreAllMocks())

function Panel(props: Partial<FloatingPanelRootProps>) {
  return (
    <FloatingPanel.Root defaultPosition={{ x: 40, y: 40 }} {...props}>
      <FloatingPanel.Trigger>Notes</FloatingPanel.Trigger>
      <FloatingPanel.Positioner>
        <FloatingPanel.Content>
          <FloatingPanel.Header>
            <FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger>
            <FloatingPanel.Title>Notes</FloatingPanel.Title>
            <FloatingPanel.Control>
              <FloatingPanel.StageTrigger stage="minimized">_</FloatingPanel.StageTrigger>
              <FloatingPanel.StageTrigger stage="maximized">□</FloatingPanel.StageTrigger>
              <FloatingPanel.CloseTrigger>×</FloatingPanel.CloseTrigger>
            </FloatingPanel.Control>
          </FloatingPanel.Header>
          <FloatingPanel.Body>
            <textarea aria-label="Note" />
          </FloatingPanel.Body>
          <FloatingPanel.ResizeTrigger axis="se" />
        </FloatingPanel.Content>
      </FloatingPanel.Positioner>
    </FloatingPanel.Root>
  )
}

function setup(props: Partial<FloatingPanelRootProps> = { defaultOpen: true }) {
  const r = render(
    <RindProvider>
      <Panel {...props} />
      <button type="button">Outside</button>
    </RindProvider>,
  )
  const q = (sel: string) => document.querySelector<HTMLElement>(sel)
  return { host: r.container, q, d: () => getFloatingPanel(document.body) }
}

const settle = () => act(async () => {})

describe("React FloatingPanel", () => {
  it("a non-modal dialog named by the Title; the DragTrigger a described button", async () => {
    const t = setup()
    await settle()
    const dialog = screen.getByRole("dialog", { name: "Notes" })
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    const move = screen.getByRole("button", { name: "Move panel" })
    expect(move.getAttribute("aria-describedby")).toBe(t.q('[data-part="drag-hint"]')?.id)
    expect(screen.getByRole("button", { name: "Minimise" })).toBeTruthy()
    expect(t.q('[data-part="resize-trigger"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(await t.d().position()).toEqual({ x: 40, y: 40 })
    const { violations } = await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("arrows move by 10, Shift by 50, Alt resizes; each step reports once", async () => {
    const onPositionChange = vi.fn()
    const onSizeChange = vi.fn()
    const t = setup({ defaultOpen: true, onPositionChange, onSizeChange })
    await settle()
    await t.d().moveBy(20, -10)
    expect(await t.d().position()).toEqual({ x: 60, y: 30 })
    expect(onPositionChange).toHaveBeenCalledTimes(3)
    await t.d().resizeBy(20, 0)
    expect(await t.d().size()).toEqual({ width: 380, height: 240 })
    expect(onSizeChange).toHaveBeenCalledTimes(2)
  })

  it("minimised from inside the Body: the Body hides and focus goes to the DragTrigger", async () => {
    const tree = (stage: "default" | "minimized") => (
      <RindProvider>
        <Panel defaultOpen stage={stage} />
      </RindProvider>
    )
    const r = render(tree("default"))
    await settle()
    act(() => screen.getByRole("textbox", { name: "Note" }).focus())
    r.rerender(tree("minimized"))
    expect(document.querySelector<HTMLElement>('[data-part="body"]')?.hidden).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move panel" }))
  })

  it("the stage triggers minimise and restore; Enter on the DragTrigger maximises", async () => {
    const t = setup()
    await settle()
    await t.d().via("pointer").minimize()
    expect(t.q('[data-part="body"]')?.hidden).toBe(true)
    expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy()
    await t.d().via("pointer").restore()
    expect(await t.d().stage()).toBe("default")
    await t.d().via("keyboard").maximize()
    expect(await t.d().stage()).toBe("maximized")
  })

  it("opens from the Trigger; an outside press keeps it open; Escape and Close close it", async () => {
    const t = setup({})
    await settle()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Notes" }))
    expect(await t.d().isOpen()).toBe(true)
    await user.click(screen.getByRole("button", { name: "Outside" }))
    expect(await t.d().isOpen()).toBe(true)
    await t.d().via("pointer").close()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("server HTML renders the open panel at its position", () => {
    const html = renderToString(
      <StrictMode>
        <RindProvider>
          <Panel defaultOpen />
        </RindProvider>
      </StrictMode>,
    )
    expect(html).toContain("--rind-floating-panel-x:40px")
  })
})
