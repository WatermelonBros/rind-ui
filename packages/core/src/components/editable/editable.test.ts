import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { editableConnect } from "./editable.connect"
import { editableContract } from "./editable.contract"
import {
  activates,
  type EditableProps,
  editableMachine,
  outsidePressSubmits,
} from "./editable.machine"
import { editableMessages } from "./editable.messages"
import { editableMeta } from "./editable.meta"

function make(over: Partial<EditableProps> = {}) {
  const focusInput = vi.fn()
  const focusPreview = vi.fn()
  const props: EditableProps = { defaultValue: "A", focusInput, focusPreview, ...over }
  const s = createService(editableMachine, props, {})
  s.start()
  const view = () => s.view(props)
  return { s, focusInput, focusPreview, view, state: () => s.getSnapshot().state }
}

describe("editable machine", () => {
  it("Escape restores the value at entry (zag#3510)", () => {
    const t = make()
    t.s.send({ type: "EDIT", reason: "preview-press" })
    expect(t.focusInput).toHaveBeenCalled()
    t.s.send({ type: "DRAFT", draft: "B" })
    t.s.send({ type: "CANCEL", reason: "escape-key" })
    expect([t.state(), t.view().values.value, t.view().context.draft]).toEqual([
      "preview",
      "A",
      "A",
    ])
    expect(t.focusPreview).toHaveBeenCalled()
  })

  it("submit commits the draft", () => {
    const onValueChange = vi.fn()
    const t = make({ onValueChange })
    t.s.send({ type: "EDIT", reason: "edit-trigger" })
    t.s.send({ type: "DRAFT", draft: "New" })
    t.s.send({ type: "SUBMIT", reason: "enter-key" })
    expect(t.view().values.value).toBe("New")
    expect(onValueChange.mock.calls[0]?.[0]).toBe("New")
  })

  it("outside press: submits by default, cancels with submitMode enter", () => {
    const a = make()
    a.s.send({ type: "EDIT", reason: "preview-press" })
    a.s.send({ type: "DRAFT", draft: "B" })
    a.s.send({ type: "OUTSIDE" })
    expect(a.view().values.value).toBe("B")
    expect(a.focusPreview).not.toHaveBeenCalled()
    const b = make({ submitMode: "enter" })
    b.s.send({ type: "EDIT", reason: "preview-press" })
    b.s.send({ type: "DRAFT", draft: "B" })
    b.s.send({ type: "OUTSIDE" })
    expect(b.view().values.value).toBe("A")
  })

  it("a vetoed edit change keeps editing", () => {
    const t = make({
      onEditChange: (edit, details) => {
        if (!edit) details.cancel()
      },
    })
    t.s.send({ type: "EDIT", reason: "preview-press" })
    t.s.send({ type: "SUBMIT", reason: "enter-key" })
    expect(t.state()).toBe("edit")
  })

  it("disabled and read-only never edit", () => {
    for (const over of [{ disabled: true }, { readOnly: true }]) {
      const t = make(over)
      t.s.send({ type: "EDIT", reason: "preview-press" })
      expect(t.state()).toBe("preview")
    }
  })

  it("activation and outside tables", () => {
    expect(activates(undefined, "press")).toBe(true)
    expect(activates(undefined, "focus")).toBe(false)
    expect(activates("focus", "focus")).toBe(true)
    expect(activates("dblclick", "press")).toBe(false)
    expect(activates("dblclick", "key")).toBe(true)
    expect(activates("none", "key")).toBe(false)
    expect(
      [undefined, "both", "blur", "enter", "none"].map((m) => outsidePressSubmits(m as never)),
    ).toEqual([true, true, true, false, false])
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof editableConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof editableConnect>[0]> = {}) =>
  editableConnect(
    {
      instance: "e",
      state: "preview",
      value: "Q3 plan",
      draft: "Q3 plan",
      disabled: false,
      readOnly: false,
      required: false,
      invalid: false,
      messages: editableMessages,
      ids: { label: "l", preview: "p", input: "i", hidden: "h" },
      rendered: { label: true },
      ...over,
    },
    env,
  )
const f = { tag: "button", focused: true, modality: "keyboard" as const }
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("editable connect", () => {
  it("the Preview is a button named by the Label and the value (regression: Zag)", () => {
    expect(api().preview(f)).toMatchObject({ type: "button", "aria-labelledby": "l p" })
    expect(api().previewText).toBe("Q3 plan")
    expect(api({ value: "", placeholder: "Untitled" }).previewText).toBe("Untitled")
  })

  it("the triggers are named with the Label; the visible input has no name", () => {
    expect(api().editTrigger(f)).toMatchObject({
      "aria-label": "Edit",
      "aria-labelledby": "p-edit-trigger l",
    })
    expect(api({ state: "edit" }).input(f)["name"]).toBeUndefined()
    expect(api({ name: "title" }).hiddenInput()["name"]).toBe("title")
  })

  it("meta matches the code", () => {
    const a = api({ value: "", disabled: true, readOnly: true, invalid: true })
    const parts = {
      root: a.root(),
      label: a.label(),
      area: a.area(),
      preview: a.preview(f),
      input: a.input(f),
      control: a.control(),
      "edit-trigger": a.editTrigger(f),
      "submit-trigger": a.submitTrigger(f),
      "cancel-trigger": a.cancelTrigger(f),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = editableMeta.dataAttributes[part as keyof typeof editableMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(editableMeta.contract.queries).toEqual(Object.keys(editableContract.queries))
    expect(Object.keys(editableMeta.states)).toEqual(Object.keys(editableMachine.def.states))
  })
})
