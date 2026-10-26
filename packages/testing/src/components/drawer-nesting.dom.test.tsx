// Drawer nesting, the indent and hydration (tasks 4.2, 6.2): metrics from the open layers,
// dialogs not counted, the indent's data-active and progress, server markup.
import { Dialog, Drawer } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { type ReactNode, StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { getDialog, getDrawer } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const contentOf = (name: string) => screen.getByRole("dialog", { name })

function Sheet({
  name,
  children,
  open,
  onOpenChange,
  height = 400,
}: {
  name: string
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  height?: number
}) {
  return (
    <Drawer.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange: (o: boolean) => onOpenChange(o) } : {})}
    >
      <Drawer.Trigger>{`Open ${name}`}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Positioner>
          <Drawer.Content
            style={{
              position: "fixed",
              insetInline: 0,
              bottom: 0,
              height,
              border: "2px solid",
              boxSizing: "border-box",
            }}
          >
            <Drawer.Title>{name}</Drawer.Title>
            {children}
            <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

describe("Drawer nesting", () => {
  it("a dialog inside a nested drawer is not counted; Escape closes only the dialog (base-ui#4492)", async () => {
    render(
      <Sheet name="Outer">
        <Sheet name="Inner">
          <Dialog.Root>
            <Dialog.Trigger>Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Content>
                <Dialog.Title>Confirm</Dialog.Title>
                <Dialog.CloseTrigger>OK</Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </Sheet>
      </Sheet>,
    )
    await getDrawer(screen, { name: "Outer", trigger: "Open Outer" }).via("keyboard").open()
    await getDrawer(screen, { name: "Inner", trigger: "Open Inner" }).via("keyboard").open()
    const dialog = getDialogLike("Confirm", "Open dialog")
    await dialog.open()
    expect(contentOf("Outer").style.getPropertyValue("--nested-layer-count")).toBe("1")
    await dialog.pressEscape()
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeTruthy()
  })

  it.skipIf(inJsdom)(
    "controlled nesting: the parent gets data-has-nested and the frontmost border-box size (vaul#540, base-ui#4201)",
    async () => {
      function Controlled() {
        const [inner, setInner] = useState(false)
        return (
          <Sheet name="Outer">
            <button type="button" onClick={() => setInner(true)}>
              Show inner
            </button>
            <Sheet name="Inner" open={inner} onOpenChange={setInner} height={300} />
          </Sheet>
        )
      }
      render(<Controlled />)
      await getDrawer(screen, { name: "Outer", trigger: "Open Outer" }).via("pointer").open()
      await act(async () => screen.getByRole("button", { name: "Show inner" }).click())
      await vi.waitFor(() => {
        const outer = contentOf("Outer")
        expect(outer.hasAttribute("data-has-nested")).toBe(true)
        expect(outer.style.getPropertyValue("--rind-drawer-frontmost-size")).toBe("300px")
      })
      await getDrawer(screen, { name: "Inner", trigger: "Open Inner" })
        .via("keyboard")
        .pressEscape()
      await vi.waitFor(() => {
        const outer = contentOf("Outer")
        expect(outer.hasAttribute("data-has-nested")).toBe(false)
        expect(outer.style.getPropertyValue("--rind-drawer-frontmost-size")).toBe("")
      })
    },
  )
})

describe("Drawer metrics after mount", () => {
  it.skipIf(inJsdom)("the parent's frontmost size follows the nested drawer's resize", async () => {
    function Resizing() {
      const [height, setHeight] = useState(300)
      return (
        <Sheet name="Outer">
          <Sheet name="Inner" height={height}>
            <button type="button" onClick={() => setHeight(200)}>
              Shrink
            </button>
          </Sheet>
        </Sheet>
      )
    }
    render(<Resizing />)
    await getDrawer(screen, { name: "Outer", trigger: "Open Outer" }).via("keyboard").open()
    await getDrawer(screen, { name: "Inner", trigger: "Open Inner" }).via("keyboard").open()
    await vi.waitFor(() =>
      expect(contentOf("Outer").style.getPropertyValue("--rind-drawer-frontmost-size")).toBe(
        "300px",
      ),
    )
    await act(async () => screen.getByRole("button", { name: "Shrink" }).click())
    await vi.waitFor(() =>
      expect(contentOf("Outer").style.getPropertyValue("--rind-drawer-frontmost-size")).toBe(
        "200px",
      ),
    )
  })

  it.skipIf(inJsdom)("a portalled bottom drawer gets its keyboard inset", async () => {
    render(<Sheet name="Sheet" />)
    await getDrawer(screen, { name: "Sheet", trigger: "Open Sheet" }).via("keyboard").open()
    await vi.waitFor(() => {
      const positioner = contentOf("Sheet").parentElement as HTMLElement
      expect(positioner.style.getPropertyValue("--rind-drawer-keyboard-inset")).toBe("0px")
    })
  })
})

const getDialogLike = (name: string, trigger: string) =>
  getDialog(screen, { name, trigger }).via("keyboard")

describe("Drawer indent", () => {
  it("data-active while a modal drawer is open", async () => {
    render(
      <>
        <Drawer.Indent>App</Drawer.Indent>
        <Drawer.IndentBackground />
        <Sheet name="Filters" />
      </>,
    )
    const indent = () => document.querySelector('[data-part="indent"]')
    expect(indent()?.hasAttribute("data-active")).toBe(false)
    const d = getDrawer(screen, { name: "Filters", trigger: "Open Filters" }).via("keyboard")
    await d.open()
    await vi.waitFor(() => expect(indent()?.hasAttribute("data-active")).toBe(true))
    await d.pressEscape()
    await vi.waitFor(() => expect(indent()?.hasAttribute("data-active")).toBe(false))
  })

  it("hydrates without a mismatch (base-ui#4509)", async () => {
    const tree = (
      <>
        <Drawer.Indent>App</Drawer.Indent>
        <Drawer.IndentBackground />
        <Sheet name="Filters" />
      </>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
        onRecoverableError: (e) => error(String(e)),
      })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
    error.mockRestore()
  })
})
