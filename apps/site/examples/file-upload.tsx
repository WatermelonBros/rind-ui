"use client"

import { Field, FileUpload, type FileUploadRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** `dragging` lasts while a file drag is over the Dropzone: reached by the driver's `dragEnter`. */
export const states: States = { "file-upload": { idle: "Single" } }

/** Phosphor (regular) icons, inline so every skin shows them; any node works in their place. */
function PhosphorIcon({ d }: { readonly d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
      <path d={d} />
    </svg>
  )
}
const UPLOAD =
  "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z"
const X =
  "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"

/** The held files: preview (images only), name, size and a Remove key. */
function Files({ preview = false }: { readonly preview?: boolean }) {
  return (
    <FileUpload.ItemGroup
      render={(props, state) => (
        <ul {...props}>
          {state.files.map((file) => (
            <FileUpload.Item key={`${file.name}-${file.size}`} file={file}>
              {preview ? <FileUpload.ItemPreview /> : null}
              <FileUpload.ItemName />
              <FileUpload.ItemSize />
              <FileUpload.ItemRemove>
                <PhosphorIcon d={X} />
              </FileUpload.ItemRemove>
            </FileUpload.Item>
          ))}
        </ul>
      )}
    />
  )
}

/** A Label, the Dropzone with its hint and Trigger, then the files. */
function Upload({
  label,
  hint,
  preview,
  clear,
  ...props
}: FileUploadRootProps & {
  readonly label?: string
  readonly hint: string
  readonly preview?: boolean
  readonly clear?: boolean
}) {
  return (
    <FileUpload.Root {...props}>
      {label ? <FileUpload.Label>{label}</FileUpload.Label> : null}
      <FileUpload.Dropzone>
        <PhosphorIcon d={UPLOAD} />
        <span>{hint}</span>
        <FileUpload.Trigger>Choose file</FileUpload.Trigger>
      </FileUpload.Dropzone>
      <Files preview={preview === true} />
      {clear ? <FileUpload.ClearTrigger>Remove all</FileUpload.ClearTrigger> : null}
    </FileUpload.Root>
  )
}

export function Single() {
  return <Upload label="CV" hint="PDF, up to 5 MB" accept=".pdf" maxFileSize={5_000_000} />
}

export function Multiple() {
  return (
    <Upload
      label="Attachments"
      hint="Up to 5 files, 10 MB each"
      maxFiles={5}
      maxFileSize={10_000_000}
      clear
    />
  )
}

export function Images() {
  return (
    <Upload
      label="Gallery"
      hint="PNG, JPEG or WebP"
      accept="image/png,image/jpeg,image/webp"
      maxFiles={8}
      preview
      clear
    />
  )
}

export function Directory() {
  return (
    <Upload label="Project folder" hint="Drop a folder or choose one" directory maxFiles={200} />
  )
}

export function InForm() {
  const [sent, setSent] = useState<string | null>(null)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const files = new FormData(e.currentTarget).getAll("receipts") as File[]
        setSent(files.map((f) => f.name).join(", "))
      }}
    >
      <Field.Root name="receipts" required>
        <Field.Label>Receipts</Field.Label>
        <Upload hint="Up to 3 files" maxFiles={3} />
        <Field.Description>Images or PDFs of this month's receipts.</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
      <div className="row">
        <button type="submit">Send</button>
        <button type="reset">Reset</button>
      </div>
      {sent === null ? null : <output>Sent: {sent || "nothing"}</output>}
    </form>
  )
}

export function Disabled() {
  return <Upload label="Avatar" hint="Uploads are paused" disabled />
}

export function ReadOnly() {
  return <Upload label="Contract" hint="Signed, cannot change" readOnly />
}

export function Controlled() {
  const [files, setFiles] = useState<readonly File[]>([])
  const total = files.reduce((sum, f) => sum + f.size, 0)
  return (
    <div className="stack">
      <Upload
        label="Assets"
        hint="Up to 4 files, 2 MB in total"
        maxFiles={4}
        files={files}
        onFilesChange={(next) => {
          // The parent decides: over 2 MB in total, the change is refused.
          if (next.reduce((sum, f) => sum + f.size, 0) <= 2_000_000) setFiles(next)
        }}
        clear
      />
      <output>{(total / 1_000_000).toFixed(2)} MB of 2 MB</output>
    </div>
  )
}

export const variants: Variants = {
  Single: {
    title: "Single file",
    description:
      "`maxFiles` defaults to 1: a new file replaces the held one; a rejected one leaves it in place.",
  },
  Multiple: {
    title: "Multiple with limits",
    description:
      "`maxFiles` and `maxFileSize`: only the surplus is refused, announced once per drop.",
  },
  Images: {
    title: "Images with previews",
    description: "`ItemPreview` draws an object URL, revoked when the file goes.",
  },
  Directory: {
    title: "Folders",
    description: "`directory`: the chooser picks a folder and a dropped folder is traversed.",
  },
  InForm: {
    title: "In a form",
    description: "Inside a `Field`: required, submitted in `FormData`, restored by Reset.",
  },
  Disabled: { title: "Disabled", description: "Nothing is taken; the Trigger is disabled." },
  ReadOnly: {
    title: "Read-only",
    description: "Focusable and announced, but the chooser stays shut and drops are refused.",
  },
  Controlled: {
    title: "Controlled",
    description: "`files` and `onFilesChange`: the parent refuses a change over 2 MB in total.",
  },
}
