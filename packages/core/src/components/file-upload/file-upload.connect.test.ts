import { describe, expect, it } from "vitest"
import type { FieldControlProps } from "../shared/field-control"
import {
  type FileUploadConnectInput,
  fileUploadConnect,
  formatFileSize,
} from "./file-upload.connect"
import { fileUploadContract } from "./file-upload.contract"
import { fileUploadMachine } from "./file-upload.machine"
import { fileUploadMessages } from "./file-upload.messages"
import { fileUploadMeta } from "./file-upload.meta"

const field: FieldControlProps = {
  disabled: true,
  readOnly: true,
  required: true,
  invalid: true,
  name: "docs",
  "aria-required": undefined,
  "aria-invalid": "true",
  "aria-describedby": "desc",
  "aria-labelledby": undefined,
  "aria-errormessage": undefined,
}

const input = (over: Partial<FileUploadConnectInput> = {}): FileUploadConnectInput => ({
  instance: "u",
  files: [{ name: "a.png", type: "image/png", size: 1200 }],
  dragging: true,
  field,
  ids: { label: "l", trigger: "t", input: "in", summary: "s" },
  labelledBy: "l",
  messages: fileUploadMessages,
  locale: "en",
  accept: ["image/*", ".pdf"],
  maxFiles: 3,
  directory: true,
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("file-upload meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(fileUploadContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(fileUploadMeta.contract.actions).toEqual(actions)
    expect(fileUploadMeta.contract.queries).toEqual(Object.keys(fileUploadContract.queries))
    expect(fileUploadMeta.contract.traits).toEqual(fileUploadContract.traits)
    expect(Object.keys(fileUploadMeta.states)).toEqual(Object.keys(fileUploadMachine.def.states))
  })

  it("data attributes", () => {
    const a = fileUploadConnect(input({ files: [] }))
    const t = { focused: true, modality: "keyboard" as const, named: false }
    const file = { name: "a.png", type: "image/png", size: 1 }
    const parts = {
      root: a.root(),
      label: a.label(),
      dropzone: a.dropzone(),
      trigger: a.trigger(t),
      "hidden-input": a.hiddenInput(),
      summary: a.summary(),
      "item-group": a.itemGroup(),
      item: a.item(0),
      "item-name": a.itemName(),
      "item-size": a.itemSize(),
      "item-preview": a.itemPreview(),
      "item-remove": a.itemRemove(file, false),
      "clear-trigger": a.clearTrigger(false),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = fileUploadMeta.dataAttributes[part as keyof typeof fileUploadMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("file-upload connect", () => {
  it("the Trigger: named Label then itself, described by the summary then the Field", () => {
    const t = fileUploadConnect(input({ field: { ...field, disabled: false } })).trigger({
      focused: false,
      modality: "pointer",
      named: false,
    })
    expect(t).toMatchObject({
      type: "button",
      "aria-labelledby": "l t",
      "aria-describedby": "s desc",
      "aria-invalid": "true",
      "aria-disabled": "true",
    })
  })

  it("the input: hidden, out of the tab order, the native attributes", () => {
    const i = fileUploadConnect(input()).hiddenInput()
    expect(i).toMatchObject({
      type: "file",
      name: "docs",
      accept: "image/*,.pdf",
      multiple: true,
      webkitdirectory: "",
      tabindex: -1,
      "aria-hidden": "true",
    })
    expect(fileUploadConnect(input({ maxFiles: 1 })).hiddenInput()["multiple"]).toBeUndefined()
  })

  it("summary like the native control", () => {
    const s = (names: string[]) =>
      fileUploadConnect(input({ files: names.map((name) => ({ name, type: "", size: 1 })) }))
        .summaryText
    expect(s([])).toBe("No file chosen")
    expect(s(["cv.pdf"])).toBe("cv.pdf")
    expect(s(["a", "b", "c"])).toBe("3 files")
  })

  it("remove and clear names; the item list name", () => {
    const a = fileUploadConnect(input())
    expect(a.itemRemove({ name: "a.png", type: "", size: 1 }, false)["aria-label"]).toBe(
      "Remove a.png",
    )
    expect(a.clearTrigger(false)["aria-label"]).toBe("Remove all files")
    expect(a.itemGroup()["aria-label"]).toBe("Selected files")
  })

  it("sizes for the locale, base 1000", () => {
    expect(formatFileSize(950, "en")).toBe("950 byte")
    expect(formatFileSize(1200, "en")).toBe("1.2 kB")
    expect(formatFileSize(2_500_000, "en")).toBe("2.5 MB")
  })
})
