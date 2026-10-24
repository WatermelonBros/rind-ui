/** @jsxImportSource solid-js */
// The File Upload contract model (React's matrix) against the Solid parts, the hidden input
// carrying files into FormData, drops, rejections, and markup parity (empty, held files with
// their items, disabled).
import {
  type FileLike,
  type FileRejection,
  fileUploadContract,
  fileUploadMessages,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { FileUpload, type FileUploadRootProps, RindProvider } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const upload = (p: P, items = false): JSX.Element => (
  <FileUpload.Root name="docs" {...(p as FileUploadRootProps<FileLike>)}>
    {(s) => (
      <>
        <FileUpload.Label>Documents</FileUpload.Label>
        <FileUpload.Dropzone>
          Drop files here
          <FileUpload.Trigger>Choose file</FileUpload.Trigger>
        </FileUpload.Dropzone>
        {items ? (
          <>
            <FileUpload.ItemGroup>
              <For each={s.files}>
                {(file) => (
                  <FileUpload.Item file={file}>
                    <FileUpload.ItemName />
                    <FileUpload.ItemSize />
                    <FileUpload.ItemRemove>Remove</FileUpload.ItemRemove>
                  </FileUpload.Item>
                )}
              </For>
            </FileUpload.ItemGroup>
            <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
          </>
        ) : null}
      </>
    )}
  </FileUpload.Root>
)
const reactWith = (p: P, items = false) =>
  r(
    R.FileUpload.Root,
    { name: "docs", ...p } as never,
    r(R.FileUpload.Label, null, "Documents"),
    r(R.FileUpload.Dropzone, null, "Drop files here", r(R.FileUpload.Trigger, null, "Choose file")),
    items
      ? r(
          R.FileUpload.ItemGroup,
          null,
          ((p["defaultFiles"] as FileLike[] | undefined) ?? []).map((file) =>
            r(
              R.FileUpload.Item,
              { key: file.name, file },
              r(R.FileUpload.ItemName),
              r(R.FileUpload.ItemSize),
              r(R.FileUpload.ItemRemove, null, "Remove"),
            ),
          ),
        )
      : null,
    items ? r(R.FileUpload.ClearTrigger, null, "Clear") : null,
  )

for (const [name, cfg] of [
  ["single", { maxFiles: 1 }],
  ["multiple", { maxFiles: 5 }],
  ["disabled", { maxFiles: 5, disabled: true }],
] as const) {
  const rec = recordingAnnouncer()
  describe(`solid file-upload model: ${name}`, () => {
    testMachine(fileUploadContract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider announcer={rec.announcer}>
            <form>
              {upload({ maxFiles: cfg.maxFiles, disabled: "disabled" in cfg })}
              <button type="reset">Reset</button>
            </form>
          </RindProvider>
        )),
      target: () => domEnv(),
      anchor: [{ name: /Choose file/ }],
      props: {
        id: "oracle",
        messages: fileUploadMessages,
        maxFiles: cfg.maxFiles,
        disabled: "disabled" in cfg,
        readOnly: false,
      },
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    } as never)
  })
}

/** Files picked through the hidden input, as the chooser would deliver them. */
function pick(input: HTMLInputElement, files: File[]) {
  const transfer = new DataTransfer()
  for (const f of files) transfer.items.add(f)
  input.files = transfer.files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}
const doc = (name: string, size = 1, type = "text/plain") =>
  new File(["x".repeat(size)], name, { type })

describe.skipIf(inJsdom)("solid file upload in a browser", () => {
  const form = (p: P) =>
    mount(() => (
      <form>
        {upload(p, true)}
        <button type="reset">Reset</button>
      </form>
    ))

  it("carries the files into FormData; remove and reset keep it in step", async () => {
    form({ maxFiles: 3 })
    const formEl = document.querySelector("form") as HTMLFormElement
    const input = document.querySelector("input[type='file']") as HTMLInputElement
    expect(new FormData(formEl).getAll("docs").map((f) => (f as File).name)).toEqual([""])
    pick(input, [doc("a.txt"), doc("b.txt")])
    await vi.waitFor(() =>
      expect(new FormData(formEl).getAll("docs").map((f) => (f as File).name)).toEqual([
        "a.txt",
        "b.txt",
      ]),
    )
    screen.getAllByRole("button", { name: /Remove/ })[0]?.click()
    await vi.waitFor(() =>
      expect(new FormData(formEl).getAll("docs").map((f) => (f as File).name)).toEqual(["b.txt"]),
    )
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(screen.queryAllByText("b.txt")).toEqual([]))
  })

  it("rejects by type, count and size, once per gesture", async () => {
    const onReject = vi.fn()
    form({ maxFiles: 2, accept: ["text/plain"], maxFileSize: 5, onReject })
    const input = document.querySelector("input[type='file']") as HTMLInputElement
    pick(input, [doc("ok.txt", 2), doc("big.txt", 9), doc("pic.png", 1, "image/png"), doc("c.txt")])
    await vi.waitFor(() => expect(onReject).toHaveBeenCalledTimes(1))
    const rejections = onReject.mock.calls[0]?.[0] as readonly FileRejection<File>[]
    expect(rejections.map((x) => [x.file.name, x.reason])).toEqual(
      expect.arrayContaining([
        ["big.txt", "MAX_SIZE"],
        ["pic.png", "ACCEPT"],
      ]),
    )
    expect(screen.getAllByText("ok.txt").length).toBeGreaterThan(0)
  })

  it("adds the files of a drop on the Dropzone", async () => {
    form({ maxFiles: 5 })
    const zone = document.querySelector("[data-part='dropzone']") as HTMLElement
    const transfer = new DataTransfer()
    transfer.items.add(doc("dropped.txt"))
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
      )
    }
    await vi.waitFor(() => expect(screen.getAllByText("dropped.txt").length).toBeGreaterThan(0))
  })
})

describe("Solid File Upload matches React", () => {
  it("empty, held files, disabled", async () => {
    const files = [
      new File(["a"], "a.txt", { type: "text/plain" }),
      new File(["bb"], "b.png", { type: "image/png" }),
    ]
    for (const [p, items] of [
      [{}, false],
      [{ maxFiles: 5, defaultFiles: files }, true],
      [{ disabled: true, required: true }, false],
    ] as const) {
      await clientParity(reactWith(p, items), () => upload(p, items))
    }
  })
})
