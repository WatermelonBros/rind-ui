## Context

The research note ([file-upload.md](../../../docs/research/file-upload.md)) compares Zag /
Ark, React Aria (DropZone + FileTrigger), Kobalte (File Field) and react-dropzone, and records
the bug history behind each scenario. Prompt Input already takes files (paste, drop, chooser)
through `core/dom/file-intake.ts` and `components/shared/file-validation.ts`. File Upload is
the second user, so those modules are generalised here, not copied.

## Goals / Non-Goals

**Goals:**
- One source of truth: the value. The native input mirrors it, and every source (chooser,
  drop, paste, API) goes through one validation.
- A layout-free machine. Files are `{ name, type, size }` records, so every rule runs in Node.
- Accessible without drag: a real Trigger button, paste, announcements and focus that never
  lands on `<body>`.

**Non-Goals:**
- Uploading, progress, `transformFiles`, the File System Access API, drag-time verdicts.

## Decisions

### 1. The control: a Trigger over the native input

`Trigger` is a `<button type="button">`, the only element that opens the chooser by keyboard.
Root renders one `<input type="file">` after its children. It is the form carrier and the
chooser, `aria-hidden`, `tabindex=-1`, with the `hidden-form-input` visually hidden style
(never `display:none`, or `required` breaks). It carries `name`, `form`, `accept`, `multiple`
(`maxFiles !== 1`), `capture`, `webkitdirectory` (`directory`), `required` and `disabled`. Its
click does not propagate into the Dropzone (RA#10092). Focus that reaches it (native
validation) moves to the Trigger.

Rejected:
- A `role="button"` drop zone (Zag, Kobalte): a second button with an English name, and
  double opens.
- A hidden button in the zone (React Aria): a dead tab stop (RA#5394).
- A visible native input: it cannot be styled, cannot list files, and cannot take drops on a
  larger area.

### 2. Machine

States `idle` and `dragging`. Context `rejections` (the last gesture's) and `pending` (an
unanswered controlled proposal). Events:

```ts
| { type: "DRAG.ENTER" } | { type: "DRAG.LEAVE" }
| { type: "FILES.ADD"; files: readonly F[]; source: "pick" | "drop" | "paste" | "api";
    refused?: readonly FileRejection<F>[] }   // directory entries that failed to read
| { type: "FILE.REMOVE"; file: F } | { type: "FILES.CLEAR" } | { type: "REJECTIONS.CLEAR" }
| { type: "PICKER.OPEN" } | { type: "RESET" } | { type: "VALUE.SYNCED" }
```

- `F extends FileLike = File`, where `FileLike = { name: string; type: string; size: number }`.
  The type parameter is inferred from `defaultFiles`, `files` or `dropSource`.
- **Validation** runs in a fixed order per file and stops at the first reason: `DIRECTORY`,
  `ACCEPT`, `MIN_SIZE`, `MAX_SIZE`, `DUPLICATE` (name + size + type against the value and the
  earlier files of the same gesture, using a `Set`), then `CUSTOM` (`validate(file, { files })`
  returns a code or `null`).
  - The count runs last. With `maxFiles` 1, the first accepted file replaces the value and any
    further accepted files are `MAX_FILES`. Otherwise only accepted files beyond
    `maxFiles - value.length` are `MAX_FILES`.
  - A gesture with no accepted file leaves the value untouched.
- `FILES.ADD` while disabled or read-only is ignored. In `dragging` it also ends the drag
  (`idle`).
- `FILE.REMOVE` for a file not in the value does nothing (removed twice).
- **One write path**, as in Rating. Uncontrolled: the value is set, the input is synced in the
  same task, and `input` + `change` are dispatched before `onFilesChange` returns. Controlled:
  the proposal waits in `pending`, then is mirrored when the prop arrives (`VALUE.SYNCED`) or
  reverted.
- `onReject(rejections)` and the announcements fire once per gesture.
- `RESET` restores the current `defaultFiles` (reason `reset`), clears the rejections, goes to
  `idle`, and dispatches no `change`.
- Effects (injected): `openPicker`, `announce`, `syncInput`, `preventDocumentDrop`.

### 3. Intake (`core/dom/file-intake.ts`, generalised)

- `dragPresence(zone, { enter, leave })` replaces `dragLeftRoot`.
  - It keeps a `Set` of entered elements: `dragenter` adds, `dragleave` deletes, and detached
    elements are pruned on every leave.
  - It calls `leave` when the set empties, on `drop`, and on a document `drop` / `dragend`.
  - It reacts only to drags where `dragHasFiles` is true, which also checks item kinds
    (rd#1409).
  - `dragover` prevents the default and sets `dropEffect = "copy"`, or `"none"` while
    disabled.
  - Prompt Input moves to it.
- `filesFromDrop(dataTransfer, { directory })` reads every item synchronously
  (`webkitGetAsEntry()` and `getAsFile()` before any `await`).
  - It recurses into directories with `readEntries` until it gets an empty batch.
  - It resolves to `{ files, refused }`. An entry that throws is refused (`DIRECTORY` without
    `directory`, otherwise `CUSTOM` with code `"unreadable"`), and the drop is never lost
    whole.
  - Relative paths are kept in a module `WeakMap` and read with `filePath(file)`, which falls
    back to `webkitRelativePath`, then to the name.
- `filesFromClipboard` is unchanged: `files` first, null items skipped (Firefox ghost item),
  and text wins.
- `syncFileInput(input, files)` builds one `DataTransfer` per call, from the real `File`s
  only. Without `DataTransfer` it sets `value = ""`.
- A chooser `change` with zero files (a cancel in older engines) is ignored, and the input is
  re-synced.

### 4. Validation (`components/shared/file-validation.ts`, generalised)

- `FileRejectionReason` gains `MIN_SIZE`, `DUPLICATE`, `DIRECTORY` and `CUSTOM`.
  `FileRejection` gains `code?: string`, and becomes generic over `F`.
- `matchesAccept(file, accept)` accepts `string | readonly string[]`. When `file.type` is
  empty, it falls back to a small built-in extension → MIME table (images incl. heic/avif,
  common video and audio, pdf, office, csv, md, json, zip).
  - `ponytail:` the table is a fixed short list; consumers list extensions for anything else.
- Accept entries are parsed once per gesture (ZG#3330).
- Prompt Input keeps its behaviour. Its reasons are a subset.

### 5. Connect

Parts `root`, `label`, `dropzone`, `trigger`, `hidden-input`, `summary`, `item-group`,
`item`, `item-name`, `item-size`, `item-preview`, `item-remove`, `clear-trigger`.

- **Trigger**:
  - `aria-labelledby = "<label id> <trigger id>"` when a Label (own or Field) exists;
  - `aria-describedby = "<summary id> <field description/error ids>"`;
  - `aria-invalid` (Field or `invalid`);
  - `disabled` while disabled;
  - `data-focus` / `data-focus-visible`.
- **Summary**: a visually hidden `span` inside the Root with `messages.summary({ count,
  names })` ("No file chosen", "cv.pdf", "3 files").
- **Item group**: `ul` named `messages.itemGroupLabel` ("Selected files"). Not rendered when
  the value is empty.
- **Item**: `li`, `data-index`.
- **Item size**: bytes via `formatFileSize(bytes, locale)` (`Intl.NumberFormat`, units
  `byte` / `kilobyte` / `megabyte` / `gigabyte`, base 1000).
- **Item remove**: `button type="button"` named `messages.removeLabel(name)`.
- **Clear trigger**: `button type="button"` named `messages.clearLabel`, not rendered while
  empty.
- **Dropzone**: `div`, no role, no `tabindex`, `data-dragging`.
- Every part carries `data-scope="file-upload"`, `data-part`, `data-instance`,
  `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-dragging` and
  `data-empty`.

### 6. React

- `FileUpload.Root` owns the machine.
  - It binds the Field and the Fieldset: one control, validity element the input, focus
    target the Trigger.
  - It binds `hidden-form-input` for reset and focus forwarding.
  - It handles `paste` while focus is inside it.
  - It registers the document-drop prevention: one shared listener with a reference count,
    off when disabled or `preventDocumentDrop={false}`.
- `FileUpload.Dropzone`:
  - connects `dropSource` (default: the DOM source over `dragPresence` and `filesFromDrop`);
  - opens the chooser on a primary-button press on its own area. Presses whose target is
    inside an interactive element, a `label` or the input are ignored, and so are presses
    whose `onClick` called `preventDefault`.
- `FileUpload.Trigger` sends `PICKER.OPEN`. The effect calls `input.click()` in the same task,
  inside the user activation.
- `FileUpload.ItemPreview` creates an object URL for `image/*` `File`s, revokes it on unmount
  and when the file changes, and renders nothing otherwise. `alt` is `""` because the Item
  name already names it.
- **Focus after removal**: the next Item's Remove, else the previous one, else the Trigger.
  After a clear: the Trigger.
- **Dev warnings**:
  - no Trigger while enabled;
  - a Trigger without a name;
  - `directory` with `maxFiles` 1.

### 7. Drop source

```ts
interface DropSink<F> { enter(): void; leave(): void; drop(files: readonly F[], refused?: readonly FileRejection<F>[]): void }
type DropSource<F> = (zone: Element, sink: DropSink<F>) => () => void
```

The default DOM source is exported from `@rind-ui/core/dom` as `domDropSource`. A Tauri source
subscribes to the webview's drag-drop events and hit-tests `zone` with the reported position.
It delivers `{ name, type, size, path }` records, which are never written to the input. The
docs carry the recipe; no Tauri code ships.

### 8. Contract

- `locate`: role `button` and the accessible name (the Trigger).
- Actions:
  - `choose(files)`: pointer clicks the Trigger, keyboard focuses it and presses Enter; both
    then call `setFiles` on the input;
  - `drop(files, { over? })`: the new env `dropFiles` on the Dropzone, optionally targeting a
    child;
  - `dragEnter`, `dragLeave`;
  - `paste(files)`: the new env `pasteFiles` on the Trigger;
  - `remove(name)`, `clear()`, `resetForm()`.
- Queries: `files` (names), `rejections` (`{ name, reason }[]`), `isDragging`, `formFiles`,
  `summary`, `isDisabled`, `isInvalid`, `isRequired`.
- Traits: `form-associated`, `field-associated`.
- Invariants:
  - the items match the value;
  - the input's `files` match the value's `File`s when `DataTransfer` exists;
  - one Trigger;
  - the Dropzone is not focusable.

The env gains:
- `dropFiles(files: readonly FileSpec[], options?: { over?: string })`: `dragenter`,
  `dragover`, `drop` with a `DataTransfer` (browser), or an event carrying a `dataTransfer`
  reader (jsdom).
- `pasteFiles(files)`: a `paste` with those files.

### 9. Model configurations

- single (`maxFiles` 1, `accept="image/*"`);
- multiple (`maxFiles` 3, `maxFileSize`);
- controlled applying;
- controlled refusing;
- disabled;
- read-only.

Steps are add (each source), remove, clear, reset, drag enter/leave. All three engines run in
browser mode; jsdom runs choose, paste, drop through the adapter, and remove.

### 10. Theme

`file-upload.css`, family `field` (`outline`, `soft`; sizes `sm` / `md` / `lg`).
- The Dropzone has a dashed `border-strong` border. With `data-dragging` it becomes solid
  with the accent tint.
- The Trigger uses the button tokens. Remove and Clear are icon-size buttons of at least
  24 × 24 px.
- Items form a list with name, size, and Remove at the end.
- Forced colors: border `CanvasText`, dragging `Highlight` and solid.
- No transition under reduced motion. Logical properties only.

## Risks / Trade-offs

- The drop zone is not keyboard-reachable. That is intended: the Trigger and paste cover it.
  The docs say to place the Trigger inside or next to the Dropzone.
- `DataTransfer` is rebuilt once per gesture. 25k files cost about 1 s in Chromium
  (ZG#3330). This is accepted and measured in the browser suite.
- Without `DataTransfer` (old jsdom), dropped and pasted files do not reach `FormData`. The
  testing setup polyfills it, or the test reads the value.
- `accept` from the extension table can disagree with a server's sniffing. The server
  validates anyway.
