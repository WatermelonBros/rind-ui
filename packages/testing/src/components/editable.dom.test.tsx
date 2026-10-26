// Editable (React) through its driver (spec editable): the Preview is a button named by the
// Label and the value; activation modes; Enter commits and Escape restores, with the focus back;
// IME composition; an outside press by submitMode; a textarea's Ctrl+Enter; the triggers; the
// form value and reset; server HTML and hydration.
import { Editable, type EditableRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getEditable } from "../index"

afterEach(() => vi.restoreAllMocks())

const settle = () => act(async () => {})

function setup(props: Partial<EditableRootProps> = {}, textarea = false) {
  const r = render(
    <RindProvider>
      <form onSubmit={(e) => e.preventDefault()}>
        <Editable.Root name="title" defaultValue="Hello" {...props}>
          <Editable.Label>Title</Editable.Label>
          <Editable.Area>
            <Editable.Preview />
            {textarea ? <Editable.Input render={<textarea />} /> : <Editable.Input />}
          </Editable.Area>
          <Editable.Control>
            <Editable.EditTrigger>Edit</Editable.EditTrigger>
            <Editable.SubmitTrigger>Save</Editable.SubmitTrigger>
            <Editable.CancelTrigger>Cancel</Editable.CancelTrigger>
          </Editable.Control>
        </Editable.Root>
        <button type="button">Elsewhere</button>
      </form>
    </RindProvider>,
  )
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    q,
    preview: () => q('[data-part="preview"]') as HTMLElement,
    input: () => q('[data-part="input"]') as HTMLInputElement,
    d: () => getEditable(document.body, { label: "Title" }),
  }
}

describe("React Editable", () => {
  it("the Preview is a button named by the Label and the value; the hidden input submits it", async () => {
    const t = setup()
    await settle()
    expect(t.preview().tagName).toBe("BUTTON")
    expect(t.preview().getAttribute("aria-labelledby")).toBe(
      `${t.q('[data-part="label"]')?.id} ${t.preview().id}`,
    )
    expect(t.input().hidden).toBe(true)
    expect(await t.d().value()).toBe("Hello")
    expect(t.q('[data-part="submit-trigger"]')?.hidden).toBe(true)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a press enters edit with the text selected; Enter commits and the focus goes back", async () => {
    const onValueChange = vi.fn()
    const t = setup({ onValueChange })
    await settle()
    await t.d().via("pointer").edit()
    await vi.waitFor(() => expect(document.activeElement).toBe(t.input()))
    expect(t.input().selectionStart).toBe(0)
    expect(t.input().selectionEnd).toBe(5)
    await t.d().type("World")
    await t.d().via("keyboard").submit()
    expect(await t.d().value()).toBe("World")
    expect(onValueChange.mock.calls[0]?.[0]).toBe("World")
    expect(onValueChange.mock.calls[0]?.[1].event.reason).toBe("enter-key")
    await vi.waitFor(() => expect(document.activeElement).toBe(t.preview()))
  })

  it("Escape restores the value at entry", async () => {
    const t = setup()
    await settle()
    await t.d().via("keyboard").edit()
    await t.d().type("Draft")
    await t.d().via("keyboard").cancel()
    expect(await t.d().value()).toBe("Hello")
    expect(await t.d().previewText()).toBe("Hello")
  })

  it("an IME composition's Enter does not commit", async () => {
    const t = setup()
    await settle()
    await t.d().via("keyboard").edit()
    act(() => {
      fireEvent.keyDown(t.input(), { key: "Enter", isComposing: true, keyCode: 229 })
    })
    expect(await t.d().isEditing()).toBe(true)
  })

  it('activationMode="dblclick": a press does nothing, a double-click edits; keys always do', async () => {
    const t = setup({ activationMode: "dblclick" })
    await settle()
    const user = userEvent.setup()
    await user.click(t.preview())
    expect(await t.d().isEditing()).toBe(false)
    await user.dblClick(t.preview())
    expect(await t.d().isEditing()).toBe(true)
  })

  it("an outside press submits by default and cancels with submitMode enter", async () => {
    const user = userEvent.setup()
    const both = setup()
    await settle()
    await both.d().via("keyboard").edit()
    await both.d().type("Kept")
    await user.click(both.host.querySelector("form > button") as HTMLElement)
    expect(await both.d().value()).toBe("Kept")
    expect(await both.d().isEditing()).toBe(false)
  })

  it("submitMode enter: an outside press cancels", async () => {
    const user = userEvent.setup()
    const t = setup({ submitMode: "enter" })
    await settle()
    await t.d().via("keyboard").edit()
    await t.d().type("Dropped")
    await user.click(t.host.querySelector("form > button") as HTMLElement)
    expect(await t.d().value()).toBe("Hello")
  })

  it("a textarea commits with Ctrl+Enter; Enter is a newline", async () => {
    const t = setup({}, true)
    await settle()
    await t.d().via("keyboard").edit()
    const area = t.input() as unknown as HTMLTextAreaElement
    expect(area.tagName).toBe("TEXTAREA")
    act(() => {
      fireEvent.keyDown(area, { key: "Enter" })
    })
    expect(await t.d().isEditing()).toBe(true)
    act(() => {
      fireEvent.keyDown(area, { key: "Enter", ctrlKey: true })
    })
    expect(await t.d().isEditing()).toBe(false)
  })

  it("the triggers edit, save and cancel", async () => {
    const t = setup()
    await settle()
    const user = userEvent.setup()
    await user.click(t.q('[data-part="edit-trigger"]') as HTMLElement)
    expect(await t.d().isEditing()).toBe(true)
    // No wait for the Input's focus (a frame later): keys typed before it are kept, not selected.
    await t.d().type("Saved")
    await t.d().via("pointer").submit()
    expect(await t.d().value()).toBe("Saved")
    await user.click(t.q('[data-part="edit-trigger"]') as HTMLElement)
    await t.d().type("Nope")
    await t.d().via("pointer").cancel()
    expect(await t.d().value()).toBe("Saved")
  })

  it("a form reset restores the default value", async () => {
    const t = setup()
    await settle()
    await t.d().via("keyboard").edit()
    await t.d().type("Changed")
    await t.d().via("keyboard").submit()
    act(() => (t.host.querySelector("form") as HTMLFormElement).reset())
    await vi.waitFor(async () => expect(await t.d().value()).toBe("Hello"))
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Editable.Root defaultValue="Hello">
            <Editable.Label>Title</Editable.Label>
            <Editable.Area>
              <Editable.Preview />
              <Editable.Input />
            </Editable.Area>
          </Editable.Root>
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-part="preview"]')?.textContent).toBe("Hello")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
