# File Upload

Takes files from the native chooser, a drop or a paste, checks them, and holds the list. The value is that list: every gesture goes through one validation, `onFilesChange` receives the whole new list, and the hidden native `<input type="file">` always holds exactly those files, so a plain form submits them. The one keyboard way in is a real Trigger button; the Dropzone is a pointer convenience with no role and no tab stop.

## When to use

- **Use it for** attaching files to a form: a CV, receipts, a gallery, a project folder.
- **Over a bare `<input type="file">`**: removing one file, adding more without losing the earlier ones, drops and pastes, limits with announced reasons (only the surplus is refused), previews, and a Trigger you can style.
- **Don't use it for** attachments inside a chat composer: [Prompt Input](prompt-input.md) takes those. Don't use it for an upload progress UI on its own: File Upload holds files, the upload is yours.

```tsx
import { FileUpload } from "@rind-ui/react"

<FileUpload.Root name="attachments" maxFiles={5} maxFileSize={10_000_000}>
  <FileUpload.Label>Attachments</FileUpload.Label>
  <FileUpload.Dropzone>
    Drop files here
    <FileUpload.Trigger>Choose file</FileUpload.Trigger>
  </FileUpload.Dropzone>
  <FileUpload.ItemGroup
    render={(props, { files }) => (
      <ul {...props}>
        {files.map((file) => (
          <FileUpload.Item key={file.name} file={file}>
            <FileUpload.ItemName />
            <FileUpload.ItemSize />
            <FileUpload.ItemRemove />
          </FileUpload.Item>
        ))}
      </ul>
    )}
  />
  <FileUpload.ClearTrigger>Remove all</FileUpload.ClearTrigger>
</FileUpload.Root>
```

## API

<!-- api:file-upload -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `FileUpload.Root` | `root` | `<div>`; holds the files; renders the hidden input and the summary after its children. |
| `FileUpload.Label` | `label` | `<span>`; with the Trigger's content, names it ("Attachments, Choose file"). |
| `FileUpload.Dropzone` | `dropzone` | `<div>`, no role, no tab stop; takes drops; a press on its own area opens the chooser. |
| `FileUpload.Trigger` | `trigger` | `<button type="button">`; opens the chooser; described by the summary. |
| (inside Root) | `hidden-input` | `<input type="file" aria-hidden tabindex="-1">`; the form carrier. |
| (inside Root) | `summary` | Visually hidden: "No file chosen", the name, or "3 files". |
| `FileUpload.ItemGroup` | `item-group` | `<ul>` named "Selected files"; not rendered while empty. |
| `FileUpload.Item` | `item` | `<li>` for one `file`. |
| `FileUpload.ItemName` | `item-name` | Its name. |
| `FileUpload.ItemSize` | `item-size` | Its size for the locale, base 1000 ("1.2 MB"). |
| `FileUpload.ItemPreview` | `item-preview` | `<img alt="">` of an image file; the object URL is revoked when it goes. |
| `FileUpload.ItemRemove` | `item-remove` | `<button>` named "Remove {name}"; empty, the theme draws an x. |
| `FileUpload.ClearTrigger` | `clear-trigger` | `<button>` named "Remove all files"; rendered only while files are held. |

Every part carries `data-dragging`, `data-empty`, `data-disabled`, `data-readonly`, `data-required` and `data-invalid`.

## Validation

A gesture's files are checked in this order: folder (unless `directory`), `accept`, `minFileSize`, `maxFileSize`, duplicate (same name, size and type, against the held files and within the gesture), `validate`, then the count. Only the files over `maxFiles` are refused, never the whole drop. With `maxFiles` 1 (the default) a valid file replaces the held one, and a refused one leaves it in place. An empty MIME type (common for `.mov`, `.heic`, `.md`) falls back to the extension.

`onReject(rejections)` is called once per gesture with `{ file, reason, code? }[]`, `reason` one of `ACCEPT`, `MAX_FILES`, `MAX_SIZE`, `MIN_SIZE`, `DUPLICATE`, `DIRECTORY`, `CUSTOM`. Rejections are announced assertively and never make the control invalid: that stays the Field's (or `invalid`'s) decision.

## Controlled

```tsx
const [files, setFiles] = useState<readonly File[]>([])
<FileUpload.Root files={files} onFilesChange={(next, { reason }) => setFiles(next)} maxFiles={4}>
```

`details.reason` is `"add"`, `"remove"`, `"clear"`, `"reset"` or `"api"`. Not applying the list refuses it: the input goes back to the held files.

## Drop sources (Tauri and others)

Drops come from `dropSource(zone, sink)`, the DOM by default. In a desktop shell whose window gets file paths instead of `File`s, pass your own; the records only need `name`, `type` and `size`:

```tsx
import { getCurrentWebview } from "@tauri-apps/api/webview"
import type { DropSource } from "@rind-ui/core"

type PathFile = { name: string; type: string; size: number; path: string }

const tauriDrops: DropSource<PathFile> = (zone, sink) => {
  const stop = getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "enter") sink.enter()
    else if (payload.type === "leave") sink.leave()
    else if (payload.type === "drop")
      sink.drop(payload.paths.map((path) => ({ name: path.split(/[\\/]/).pop() ?? path, type: "", size: 0, path })))
  })
  return () => void stop.then((unlisten) => unlisten())
}

<FileUpload.Root<PathFile> dropSource={tauriDrops} maxFiles={10}>…</FileUpload.Root>
```

Records that are not `File`s are held and reported but never put in the form input.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On the Trigger: opens the file chooser. |
| Ctrl+V / ⌘V | Focus inside the File Upload: adds the pasted files. |
| Enter, Space | On a Remove button: removes that file; focus moves to the next Remove, else the previous, else the Trigger. |

## Accessibility notes

- **One real button.** The Trigger is the keyboard and screen-reader way in; the Dropzone is never a fake button (react-spectrum#5394).
- **Like the native control.** The Trigger is described by the summary ("No file chosen", the file name, "3 files").
- **Announced.** Added and removed files are announced politely, rejections assertively, once per gesture.
- **Read-only** keeps the Trigger focusable with `aria-disabled`; **disabled** disables it and nothing is submitted.
- **Not colour alone.** The theme's Dropzone turns from dashed to solid while dragging; Remove and Clear are at least 24 × 24 CSS px.
- **Missed drops.** A file dropped outside a Dropzone does not navigate the page (`preventDocumentDrop`).

## Testing

```tsx
import { getFileUpload } from "@rind-ui/testing"

const upload = getFileUpload(screen, { name: /Choose file/ })
await upload.choose([{ name: "cv.pdf", type: "application/pdf", content: "%PDF" }])
await upload.drop([{ name: "a.png", type: "image/png", content: "x" }])
expect(await upload.files()).toEqual(["cv.pdf", "a.png"])
await upload.remove("cv.pdf")
expect(await upload.summary()).toBe("a.png")
```

Contract actions: `choose`, `drop`, `dragEnter`, `dragLeave`, `paste`, `remove(name)`, `clear`, `resetForm`. Queries: `files`, `isDragging`, `summary`, `isDisabled`, `isInvalid`, `isRequired`.

## Tested with

<!-- tested-with:file-upload -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
