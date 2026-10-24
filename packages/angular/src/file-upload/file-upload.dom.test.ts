// The File Upload contract model (React's matrix) against the Angular parts, and markup parity
// (empty, held files with their items, disabled).
import { Component } from "@angular/core"
import { type FileLike, fileUploadContract, fileUploadMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { FileUpload } from "./file-upload"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface P {
  readonly maxFiles?: number
  readonly defaultFiles?: readonly FileLike[]
  readonly disabled?: boolean
  readonly required?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; items: boolean; announcer?: unknown } = { p: {}, items: false }

const UPLOAD = `<div
      rindFileUploadRoot
      name="docs"
      #u="rindFileUploadRoot"
      [maxFiles]="p.maxFiles ?? 1"
      [defaultFiles]="p.defaultFiles"
      [disabled]="p.disabled ?? false"
      [required]="p.required ?? false"
    >
      <span rindFileUploadLabel>Documents</span>
      <div rindFileUploadDropzone>Drop files here<button rindFileUploadTrigger>Choose file</button></div>
      @if (items) {
        <ul rindFileUploadItemGroup>
          @for (file of u.state().files; track file.name) {
            <li rindFileUploadItem [file]="file">
              <span rindFileUploadItemName></span>
              <span rindFileUploadItemSize></span>
              <button rindFileUploadItemRemove>Remove</button>
            </li>
          }
        </ul>
        <button rindFileUploadClearTrigger>Clear</button>
      }
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, FileUpload],
  template: `@if (announcer) {
      <ng-container rindProvider [announcer]="$any(announcer)">
        <form>${UPLOAD}<button type="reset">Reset</button></form>
      </ng-container>
    } @else {
      ${UPLOAD}
    }`,
})
class Tree {
  readonly p = current.p
  readonly items = current.items
  readonly announcer = current.announcer
}
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
          (p.defaultFiles ?? []).map((file) =>
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
  describe(`angular file-upload model: ${name}`, () => {
    testMachine(fileUploadContract, {
      test: it,
      setup: () => {
        current = {
          p: { maxFiles: cfg.maxFiles, disabled: "disabled" in cfg },
          items: false,
          announcer: rec.announcer,
        }
        return mount(Tree)
      },
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

describe("Angular File Upload matches React", () => {
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
      current = { p, items }
      await both(reactWith(p, items), Tree)
    }
  })
})
