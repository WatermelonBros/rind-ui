// The File Upload contract model (React's matrix) against the Svelte parts, and DOM parity
// (empty, held files with their items, disabled).
import { type FileLike, fileUploadContract, fileUploadMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Docs from "../../fixtures/file-upload/docs.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
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
  describe(`svelte file-upload model: ${name}`, () => {
    testMachine(fileUploadContract, {
      test: it,
      setup: () =>
        mount(Docs, {
          root: { maxFiles: cfg.maxFiles, disabled: "disabled" in cfg },
          announcer: rec.announcer,
        } as never),
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

describe("Svelte File Upload matches React", () => {
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
      await clientParity(reactWith(p, items), Docs, { root: p, items } as never)
    }
  })
})
