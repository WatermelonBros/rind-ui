// The File Upload contract model (React's matrix) against the Vue parts, and markup parity
// (empty, held files with their items, disabled).
import { type FileLike, fileUploadContract, fileUploadMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { FileUpload, type FileUploadRenderState, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const upload = (p: P, items = false) =>
  h(
    FileUpload.Root,
    { name: "docs", ...p },
    {
      default: (s: FileUploadRenderState<FileLike>) => [
        h(FileUpload.Label, null, () => "Documents"),
        h(FileUpload.Dropzone, null, () => [
          "Drop files here",
          h(FileUpload.Trigger, null, () => "Choose file"),
        ]),
        ...(items
          ? [
              h(FileUpload.ItemGroup, null, () =>
                s.files.map((file) =>
                  h(FileUpload.Item, { key: file.name, file }, () => [
                    h(FileUpload.ItemName),
                    h(FileUpload.ItemSize),
                    h(FileUpload.ItemRemove, null, () => "Remove"),
                  ]),
                ),
              ),
              h(FileUpload.ClearTrigger, null, () => "Clear"),
            ]
          : []),
      ],
    },
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
  describe(`vue file-upload model: ${name}`, () => {
    testMachine(fileUploadContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(RindProvider, { announcer: rec.announcer }, () =>
            h("form", null, [
              upload({ maxFiles: cfg.maxFiles, disabled: "disabled" in cfg }),
              h("button", { type: "reset" }, "Reset"),
            ]),
          ),
        ),
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

describe("Vue File Upload matches React", () => {
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
      await serverParity(reactWith(p, items), () => upload(p, items))
      await clientParity(reactWith(p, items), () => upload(p, items))
    }
  })
})
