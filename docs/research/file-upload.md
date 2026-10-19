# File Upload — research

Status: done · Wave: 3

A File Upload lets the user choose one or more files for a form. The user can choose them with
the system file chooser, drop them on a drop zone, or paste them. The component then shows the
chosen files, refuses the ones that break its rules (type, size, count) and says why. It also
submits the files with the form. Three of the nine libraries ship one: Ark/Zag (`file-upload`),
React Aria (`DropZone` + `FileTrigger`, two unrelated pieces) and Kobalte (`FileField`).
react-dropzone is the de facto React hook and has the longest bug history. Radix and Base UI
have open requests; Headless UI, Ariakit, Reka UI and Bits UI have none.

The core question is what the accessible control is. The native `<input type="file">` already
does most of the work: it opens the system chooser, submits the files, resets with the form
and validates `required`. What it lacks is a drop target, paste, a file list, and validation
that the user can see. This note records how each library solved that, the bug history, and
the decisions for `add-file-upload`.

Builds on [prompt-input.md](prompt-input.md) (file intake: paste, drop, `DataTransfer` sync,
the accept grammar; the first rind component that takes files), `hidden-form-input`,
[field.md](field.md) and [form.md](form.md) (`field-control`, `field-validation`), and the
cross-cutting notes [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md).

Sources read (via `gh api`, 2026-10-19):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/file-upload/src/{file-upload.machine,file-upload.connect,file-upload.dom,file-upload.props,file-upload.utils,file-upload.anatomy}.ts`; `zag/packages/utilities/file-utils/src/{accept,data-transfer,mime-types,validate-file}.ts`; the Ark part list in `ark/packages/react/src/components/file-upload/` |
| React Aria | `react-aria-components/src/{DropZone,FileTrigger}.tsx`; `react-aria/src/dnd/{useDrop,useClipboard,DragManager,utils}.ts` (dnd moved out of `@react-aria/dnd`) |
| Kobalte | `kobalte/packages/core/src/file-field/*` (root, dropzone, trigger, hidden-input, item parts, `util.ts`) |
| react-dropzone | `react-dropzone/src/{index.tsx,utils/index.ts}`, `file-selector/src/{file-selector,file}.ts`, `attr-accept/src/index.ts` |
| rind-ui | `core/src/dom/file-intake.ts`, `core/src/components/shared/file-validation.ts` (from `add-prompt-input`) |
| Requests | [BU#1492](https://github.com/mui/base-ui/issues/1492) (open; [BU#3090](https://github.com/mui/base-ui/issues/3090) FileTrigger request closed as its duplicate), [RX#1327](https://github.com/radix-ui/primitives/issues/1327) (closed, never started) |

## Pattern

- WAI-ARIA APG: **none**. [accessibility.md](accessibility.md) §1.5 lists File Upload as
  "button + drop zone". The closest references are the HTML file input and the
  [GOV.UK file upload](https://design-system.service.gov.uk/components/file-upload/) component:
  a native input, a visible label, and an error message in the description.
- Roles and attributes required:
  - The control that opens the chooser is a `button` (or the native file input, which maps to
    a button in every accessibility API). Its name says what is uploaded ("CV").
  - The current selection is part of the description. The native input reads "No file
    chosen" or the file name.
  - `aria-invalid` and `aria-describedby` for errors (Field), as on any form control.
- Keyboard interactions required: Enter and Space on the button open the chooser (native
  button). Nothing else is required. Dragging needs a non-drag alternative (WCAG 2.5.7,
  rule 21), and the button is that alternative.

## How the others built it

| | Zag / Ark | Kobalte | React Aria | react-dropzone |
|---|---|---|---|---|
| Chooser control | `Trigger` `button` + hidden input | `Trigger` `button` + hidden input | `FileTrigger` wraps a pressable child; input `display:none` | consumer button calls `open()`; root is focusable |
| Drop zone | `div role="button" tabindex=0` (`role="application"` with `disableClick`), `aria-label` "dropzone" | `div role="button" tabindex=0 aria-label="dropzone"` (hard-coded) | `div` holding a visually hidden `button` "DropZone" (the drop and paste target) | `role="presentation" tabindex=0` (was `button`, changed by rd#1152) |
| Enter/Space on zone | opens chooser | opens chooser (no `preventDefault`, Space scrolls) | hidden button does nothing (RA#5394) | opens chooser |
| Drag tracking | `relatedTarget` containment | one boolean, no `dragenter` (flickers) | `Set` of entered elements, prune detached (WebKit `relatedTarget` is null) | array of entered targets, prune, Firefox duplicates |
| Accept / reject during drag | no | no | `getDropOperation(types)`; Safari has no types | `isDragAccept` / `isDragReject` / `isDragUnknown` |
| Accept matching | MIME, `type/*`, `.ext`; **extension fallback when `type` is empty** (mime table) | attr-accept copy, no fallback | consumer | attr-accept + file-selector fills `type` from the extension |
| Count | `maxFiles` (1); a batch that overflows rejects **all** of it | `maxFiles` (1) per batch only, no total cap | consumer | only the surplus gets `too-many-files` |
| Errors | per file `FileError[]`: `TOO_MANY_FILES`, `FILE_INVALID_TYPE`, `FILE_TOO_LARGE`, `FILE_TOO_SMALL`, `FILE_INVALID`, `FILE_EXISTS` | same minus the last two | — | `file-invalid-type`, `file-too-large`, `file-too-small`, `too-many-files`, custom |
| Duplicates | `FILE_EXISTS` (name+size+type) | no | — | no |
| Paste | `setClipboardFiles(dt)` API, consumer wires it | no | `useClipboard` on the hidden button | `noPaste` (new) |
| Directories | `directory` → `webkitdirectory`; drop recurses `readEntries` until empty, `relativePath` | no | `kind: "directory"` items, async `getEntries()` | file-selector: `getAsFileSystemHandle`, then entries |
| Form | input synced from accepted files via `DataTransfer` + `change` | input never synced | none (RA#5751, #7980, #6835) | none (rd#880) |
| Form reset | none | none | — | — |
| Announcements | none | none | virtual drag only | none |

### Zag.js / Ark UI

- Source: `file-upload.machine.ts`, `file-upload.connect.ts`, `file-upload.utils.ts`,
  `file-utils/src/*`. Ark wraps each part in one file: Root, Dropzone, Trigger, Label,
  HiddenInput, ItemGroup, Item, ItemName, ItemSizeText, ItemPreview, ItemPreviewImage,
  ItemDeleteTrigger, ClearTrigger.
- API: `accept` (string, array or `{mime: exts}` record), `acceptedFiles` /
  `defaultAcceptedFiles`, `maxFiles` (1; `multiple` = `maxFiles > 1`), `minFileSize`,
  `maxFileSize`, `validate(file, {acceptedFiles, rejectedFiles})`, `directory`, `capture`,
  `allowDrop`, `preventDocumentDrop` (true), `transformFiles` (async), `invalid`, `required`,
  `name`, `disabled`, `readOnly`, `locale` (for `formatBytes`), `translations`. Callbacks
  `onFileChange`, `onFileAccept`, `onFileReject`. The API adds `openFilePicker`,
  `deleteFile(file, type)`, `setFiles`, `clearFiles`, `clearRejectedFiles`, `createFileUrl`,
  `setClipboardFiles(dataTransfer)`, `maxFilesReached`, `remainingFiles`.
- State model: `idle | focused | dragging`. Events `OPEN`, `DROPZONE.CLICK`,
  `DROPZONE.FOCUS/BLUR`, `DROPZONE.DRAG_OVER/DRAG_LEAVE/DROP`, `FILE.SELECT`, `FILE.DELETE`,
  `FILES.SET`, `FILES.CLEAR`, `REJECTED_FILES.CLEAR`. Context `acceptedFiles`,
  `rejectedFiles`, `transforming`.
- Notable:
  - The hidden input is kept in sync with the accepted files: after every change it builds a
    `DataTransfer`, assigns `input.files` and dispatches `change`, so form libraries see dropped
    files ([ZG#2177](https://github.com/chakra-ui/zag/issues/2177)).
  - The accept matcher falls back to a MIME type derived from the extension when `file.type`
    is empty ([ZG#2571](https://github.com/chakra-ui/zag/issues/2571): a dropped `.mov`).
  - Duplicates are refused with `FILE_EXISTS`, using a `Set` keyed on name|size|type. That
    was a fix for a 13-second freeze on 25k files
    ([ZG#3330](https://github.com/chakra-ui/zag/issues/3330)).
  - `preventDocumentDrop` stops a missed drop from navigating the tab to the file.
  - Single mode (`maxFiles` 1) replaces the file. A batch where every file is rejected keeps
    the previous file ([ZG#1903](https://github.com/chakra-ui/zag/issues/1903)).
  - The input's `onClick` sets `value = ""`, so the same file can be picked again
    ([ZG PR #869](https://github.com/chakra-ui/zag/pull/869)).
- Problems:
  - The drop zone is a `role="button"` with a hard-coded English name "dropzone". It is a
    second button next to the Trigger, and both open the same chooser. A `label` inside it
    opened the chooser twice ([ZG#3387](https://github.com/chakra-ui/zag/issues/3387),
    "usage issue", docs note).
  - Child flicker is guarded by `relatedTarget`, which WebKit sets to `null` on `dragleave`.
  - A batch that would overflow `maxFiles` rejects every file in it, also the ones that fit.
  - There is no form reset, no announcement and no built-in paste.
  - `aria-invalid` was derived from the rejected files and was wrong; it is now an explicit
    `invalid` prop with `data-invalid` only
    ([ZG#1819](https://github.com/chakra-ui/zag/issues/1819)).
  - Rebuilding the `DataTransfer` on every change is quadratic in Chromium
    (`DataTransferItemList.add`, maintainer note in ZG#3330).

### React Aria

- Source: `DropZone.tsx`, `FileTrigger.tsx`, `dnd/useDrop.ts`, `dnd/useClipboard.ts`,
  `dnd/DragManager.ts`, `dnd/utils.ts`.
- API:
  - `FileTrigger`: `acceptedFileTypes` (joined into `accept`), `allowsMultiple`,
    `defaultCamera` (`capture`), `acceptDirectory` (`webkitdirectory`), `onSelect(FileList)`.
    It renders the child through a `PressResponder` plus an `<input type=file
    style="display:none">`. On press it clears `input.value`, then calls `input.click()`.
  - `DropZone`: `getDropOperation(types, allowed)`, `onDropEnter/Move/Activate/Exit`,
    `onDrop(items)`, `isDisabled`. It renders a `div` that holds a visually hidden `button`.
    The button carries the name ("DropZone" by default, or a `<Text slot="label">`), the
    paste listener, and the target of a keyboard or screen-reader "virtual drop" from a
    draggable in the same page (DragManager).
- Notable:
  - `useDrop` tracks `dragOverElements: Set<Element>`. It adds on `dragenter`, deletes on
    `dragleave`, prunes detached elements, and exits when the set is empty. The source cites
    WebKit bug 66547 (`relatedTarget` is always `null`).
  - `readFromDataTransfer` runs synchronously inside the `drop` handler, because the data is
    gone after it returns. It skips the ghost `image/png` item that Firefox adds to a file
    paste (Mozilla 1699743). Directories are `{kind: "directory", getEntries()}`, which loops
    `readEntries` until it gets an empty batch.
  - `DragTypes` treats an empty item type as "unknown". It notes that Safari exposes no
    items during `dragover` (WebKit 223517), so type filtering only works at drop time.
  - The DropZone's `onClick` focuses the hidden button when the click lands on a
    non-focusable area.
- Problems:
  - The hidden button is a tab stop that does nothing on Enter, next to a FileTrigger that
    does ([RA#5394](https://github.com/adobe/react-spectrum/issues/5394), open; the
    maintainers keep it "for AT").
  - The button had no `type` and submitted the form
    ([RA#6230](https://github.com/adobe/react-spectrum/issues/6230)).
  - `input.click()` bubbled to the DropZone, which focused the hidden button and scrolled a
    panel ([RA#10092](https://github.com/adobe/react-spectrum/issues/10092)).
  - There is no form support at all: no `name`
    ([RA#5751](https://github.com/adobe/react-spectrum/issues/5751), won't fix), no
    FileField ([RA#7980](https://github.com/adobe/react-spectrum/issues/7980), open), and no
    `dataTransfer` in `onDrop` to feed an input
    ([RA#6835](https://github.com/adobe/react-spectrum/issues/6835), open).
  - A keyboard virtual drop only carries text, never files (devongovett in RA#6835).

### Kobalte (File Field)

- Source: `file-field-root.tsx` (`div role="group"`), `file-field-dropzone.tsx`,
  `file-field-trigger.tsx`, `file-field-hidden-input.tsx`, item parts, `util.ts`.
- API: `multiple`, `accept` (string or array), `maxFiles` (1), `maxFileSize`, `minFileSize`,
  `validate(file) => FileError[] | null`, `allowDragAndDrop` (true), `onFileAccept`,
  `onFileReject`, `onFileChange({acceptedFiles, rejectedFiles})`, form-control props,
  `translations`.
- Notable: the parts list matches Ark's (ItemPreviewImage, ItemSize, ItemDeleteTrigger). The
  drop check accepts the old Firefox type `application/x-moz-file`.
- Problems (from the source and its tracker):
  - The drop zone is `role="button" tabindex=0 aria-label="dropzone"`. Enter and Space open
    the chooser even when the key comes from a child, and Space is not prevented, so the page
    scrolls.
  - The drag state is a single boolean set on `dragover` and cleared on `dragleave`, so it
    flickers over children. `allowDragAndDrop` is read without being called in two handlers,
    so `false` does not turn drag and drop off there.
  - The hidden input is never synced: dropped or removed files differ from what the form
    submits. There is no reset handling.
  - The same file cannot be picked again after removing it
    ([KB#573](https://github.com/kobaltedev/kobalte/issues/573), open).
  - `maxFiles` is checked per batch with no total cap
    ([KB#572](https://github.com/kobaltedev/kobalte/issues/572), open).
  - `onFileChange` reports the batch on add but the whole list on delete
    ([KB#571](https://github.com/kobaltedev/kobalte/issues/571), open).
  - `isValidFileSize` skips 0-byte files and has a leftover `console.log`.

### react-dropzone

- Source: `src/index.tsx` (`useDropzone`), `src/utils/index.ts`, `file-selector`,
  `attr-accept`.
- API: `getRootProps()` (`role="presentation"`, `tabIndex=0` unless `noKeyboard`/disabled),
  `getInputProps()` (`type=file`, `tabIndex=-1`, zero-size in-flow style), `open()`,
  `accept` (`{mime: exts}` or `AcceptGroup[]`), `maxFiles`, `minSize`, `maxSize`,
  `validator`, `noClick`, `noKeyboard`, `noDrag`, `noPaste`, `useFsAccessApi` (true),
  `onDrop`, `onDropAccepted`, `onDropRejected`, `onFileDialogCancel`.
- Notable:
  - The input style comments record three lessons. `display:none` breaks `required`
    validation (rd#1268). `position:absolute` scrolls the page on focus (rd#1413).
    `maxWidth:0` stops Safari from widening a shrink-to-fit parent (rd#1553).
  - Drag tracking uses an array of entered targets. It prunes targets that are no longer in
    the root, and removes one occurrence on `dragleave`, because Firefox repeats enter/leave
    on the same element.
  - While dragging, only `DataTransferItem`s exist (type and kind, no name or size), so the
    validator is never run mid-drag (rd#1408). With a validator, the verdict is `unknown`.
  - `getAsFile()` is read synchronously before any `await`, or Chromium neuters the item
    (rd#1435). Directories prefer `getAsFileSystemHandle` (Edge fails on `readEntries`,
    fs#130).
  - Count: only valid files take a slot, and only the surplus is rejected (19.0.0, rd#1358).
- Problems:
  - The `showOpenFilePicker` path ignores folders (rd#1245), is blocked by Edge policies
    (rd#1282, #1429), and treats `accept` as advisory (rd#1285).
  - The drop never reaches the form (rd#880, workaround only).
  - The root is a focusable `presentation`, which is a tab stop with no role. A commenter on
    rd#1152 calls that worse than `button`.
  - "File dialog cancel" is detected with a 300 ms timer after window focus.

## Accessibility

Applies [accessibility.md](accessibility.md) §2 (names), §4 (focus), §5 (press), §7
(announcements), §8 (target size) and §9 (numbers: file sizes, counts), rules 10, 11, 14, 21,
22, 23 and 25, and the AT note's causes A, C, D, J and K.

### What is the control

| Option | For | Against |
|---|---|---|
| Native `<input type="file">` visible and focusable (GOV.UK) | Native everywhere: role, name from `<label>`, "No file chosen", Enter/Space, touch AT | Its button cannot be styled across engines (`::file-selector-button` only). It cannot show a list, remove one file, or receive a drop or paste beyond its own box. Its text is in the browser's language. |
| Drop zone as `role="button"` (Zag, Kobalte) | One big target | A second button for the same action, a hard-coded English name ("dropzone"), nested interactive children inside a button (rd#1152), a label inside it opens the chooser twice (ZG#3387) |
| Hidden button in the zone (React Aria) | Paste target, virtual drop | A dead tab stop (RA#5394), form submit (RA#6230), scroll jump (RA#10092); a virtual drop carries no files |
| **A `Trigger` `<button>` + the native input as an `aria-hidden` carrier** | One tab stop with a real role. The native input still opens the chooser and submits, resets and validates. | The name and the "no file chosen" summary must be rebuilt (below). |

Decision: the last row. The drop zone is a pointer and drag convenience with no role and no
tab stop. Keyboard and screen-reader users have the Trigger, which opens the native chooser
(rule 21), and paste.

### Rules for rind-ui

- **Name.** The Trigger is named by the Label first, then its own content: `aria-labelledby
  = "<label> <trigger>"`, which reads "CV, Choose file". It is never named "dropzone".
  Without a visible Label the consumer passes `aria-label`. A dev warning fires when the
  Trigger has neither.
- **Selection summary.** A native file input reads "No file chosen" or the file name. The
  Trigger's `aria-describedby` starts with a visually hidden summary from
  `messages.summary({count, names})`: "No file chosen", "cv.pdf", or "3 files". The Field
  description and error follow. The summary is not live; changes are announced (below).
- **Keyboard.** The Trigger is a native `button type="button"` (RA#6230), activated on
  Enter/Space by the platform. The drop zone has no key handling and no `tabindex`. File
  items are a list whose Remove buttons are in the Tab order: a short list of buttons, not a
  composite. Paste is handled while focus is inside the Root, for example on the Trigger
  (RA's paste needs focus on its hidden button).
- **Focus.**
  - The chooser returns focus to the Trigger natively.
  - Removing a file moves focus to the next item's Remove button, else the previous one,
    else the Trigger. It never lands on `<body>` (rule 11).
  - "Clear all" moves focus to the Trigger.
  - A press on the drop zone's empty area opens the chooser and does not focus anything
    hidden (RA#10092).
  - Native validation that focuses the hidden input is forwarded to the Trigger with
    `data-focus-visible` (`hidden-form-input`).
- **Announcements** (§7, rule 23). Through the injected Announcer only, once per gesture:
  - added: polite. "cv.pdf added" or "3 files added".
  - rejected: assertive, because it is an error. "photo.heic is not an accepted file type"
    for one file, "2 files not added" for several. A gesture that adds some files and
    refuses others announces both, and the rejection is never silent
    ([vercel/ai-elements#511](https://github.com/vercel/ai-elements/issues/511)).
  - removed: polite. "cv.pdf removed".
  - Nothing is announced while dragging. No library announces any of this; Zag and Kobalte
    leave rejections to the consumer.
- **Errors.** `aria-invalid` comes only from the Field or the `invalid` prop, never from the
  rejected files of the last gesture. A rejection is an event: it is announced and reported,
  and the files already accepted stay valid (ZG#1819). `required` is native: the file input
  with no files reports `valueMissing`.
- **Drag** (2.5.7, rule 21): the Trigger is the alternative, so drop is never the only way.
  React Aria's keyboard virtual drop moves in-page items, not OS files, so it does not apply
  here.
- **Target size.** The Trigger and each Remove button are at least 24 × 24 CSS px. The drop
  zone is larger but is not the only target.
- **Forced colors** (cause K). The drop zone border is dashed and turns solid while dragging,
  so the state is a shape, not a colour. It uses system colours (`CanvasText`, `Highlight`).
- **Touch / mobile AT** (cause J). Touch screen readers activate the Trigger with a bare
  click (cause A), which the native button handles. iOS and Android have no drag from the OS
  into a page in most browsers, so the Trigger is the main path. `capture` lets a phone
  offer the camera.
- **Motion.** The `dragging` highlight has no transition under reduced motion.
- **Native platform** ([native-platform.md](native-platform.md)):
  - `<input type="file">` is the base. It provides the OS chooser, `accept`, `multiple`,
    `capture`, `webkitdirectory`, form value, `required`, and reset to empty. The `cancel`
    event exists in every engine.
  - Assigning `input.files` from a `DataTransfer` works in every engine and makes dropped
    and pasted files submit.
  - `showOpenFilePicker` is not used. It is Chromium only, ignores folders and `accept`, and
    is blocked by policies (rd#1245, #1282, #1285).

## Bug history

Method: Zag's 3191 and Ark's 3790 issue and PR titles listed through the REST API and
filtered (search was rate limited); `gh search issues` (open and closed) on
`adobe/react-spectrum` ("DropZone", "FileTrigger", "file upload", "useDrop", "drop zone",
"acceptedFileTypes", "directory drop"), `kobaltedev/kobalte` ("file field", "file",
"dropzone", "upload"), `react-dropzone/*` ("accept", "safari", "firefox", "directory",
"dragleave", "form", "FormData", "reset", "accessibility", "maxFiles", "same file",
"showOpenFilePicker", "mime"); `unovue/reka-ui`, `huntabyte/bits-ui`, `ariakit/ariakit`
("file upload": no component, no request). Every Zag/Ark file-upload issue found is closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#2571](https://github.com/chakra-ui/zag/issues/2571) closed | Dropped `.mov` refused by `accept="video/*"` | `file.type` is `""` for some files (entries from a drop, uncommon types) | MIME from the extension when `type` is empty | Accept matcher falls back to an extension table; scenario |
| react-dropzone | [fs#3](https://github.com/react-dropzone/file-selector/issues/3), [fs#25](https://github.com/react-dropzone/file-selector/issues/25) closed | `.docx`, `.xls` have no type and are refused | Browser leaves `type` empty | `COMMON_MIME_TYPES` table | Same; docs advise listing extensions too |
| react-dropzone | [rd#1285](https://github.com/react-dropzone/react-dropzone/issues/1285) closed | `.csv` shown with a `text/plain` filter; CSV is `application/vnd.ms-excel` on Windows | Platform MIME differences; FS Access picker filter is advisory | Docs | `accept` is a hint to the chooser; every path validates again; docs: list `.csv` |
| RA | [#8078](https://github.com/adobe/react-spectrum/issues/8078) closed | Windows "All files" lets any file through | Native `accept` is only a hint | Won't fix | Validate every pick, not only drops |
| attr-accept | [aa#50](https://github.com/react-dropzone/attr-accept/issues/50) closed | `.xlsm` MIME case differs Windows/Mac | Case-sensitive compare | Lowercased | Case-insensitive (already in `matchesAccept`) |
| react-dropzone | [rd#1220](https://github.com/react-dropzone/react-dropzone/issues/1220) closed | `{'image/*': ['.png']}` lets any image in | MIME match wins over the extensions in a group | Workaround | One flat native grammar: an entry matches or not; no grouped semantics |
| Zag | [#3330](https://github.com/chakra-ui/zag/issues/3330) closed | 25k dropped files freeze the tab 13 s | O(n²) dedup; accept re-parsed per file; `DataTransfer` rebuilt per change | `Set` dedup, accept parsed once | Parse once, dedup by key, sync the input once per gesture |
| Zag | [#3048](https://github.com/chakra-ui/zag/issues/3048) closed | Duplicates accepted; removing one removes all | No duplicate check; delete by equality | `FILE_EXISTS` | `DUPLICATE` rejection; removal by identity |
| Zag | [#2120](https://github.com/chakra-ui/zag/issues/2120) closed | List and `input.files` disagree; duplicates ×4 | Two sources of truth | Fixed in two rounds | The value is the one source; the input mirrors it |
| react-dropzone | [rd#880](https://github.com/react-dropzone/react-dropzone/issues/880) closed | Dropped files missing from native submit | Drop never sets `input.files` | Workaround | Sync `input.files` from the value through `DataTransfer` |
| RA | [#5751](https://github.com/adobe/react-spectrum/issues/5751) closed, [#7980](https://github.com/adobe/react-spectrum/issues/7980) open, [#6835](https://github.com/adobe/react-spectrum/issues/6835) open, [#10063](https://github.com/adobe/react-spectrum/issues/10063) open | No `name`, no FileField, no way to feed a form from a drop | Forms deliberately out of scope | Open | `name`, `form`, `required`, Field and Form integration are part of the component |
| Kobalte | source | Hidden input never synced, no reset | — | — | Same lesson; reset scenario |
| Zag | [#2177](https://github.com/chakra-ui/zag/issues/2177) closed | Form library revalidated on picks but not on drops | No `change` after a drop | `change` dispatched after each sync | `input` + `change` on the input for every user change (not for parent or reset changes) |
| Kobalte | [#573](https://github.com/kobaltedev/kobalte/issues/573) open | The same file cannot be added after removing it | Input keeps its old selection, no `change` | Open | The input always mirrors the value, so after a removal it no longer holds the file |
| RA | [#4925](https://github.com/adobe/react-spectrum/issues/4925) closed; Zag [PR #869](https://github.com/chakra-ui/zag/pull/869) | Same file twice: nothing; second open fails on Safari/iOS and Firefox | Unchanged value fires no `change` | Clear `value` before opening | Covered by mirroring; scenario "pick, remove, pick again" |
| Kobalte | [#572](https://github.com/kobaltedev/kobalte/issues/572) open | `maxFiles=1` ends with 2 files; 2 at once rejects both | Per-batch count, no total cap | Open | Count against the total |
| react-dropzone | [rd#1358](https://github.com/react-dropzone/react-dropzone/issues/1358), [#1253](https://github.com/react-dropzone/react-dropzone/issues/1253) closed | Surplus handling debated | — | 19.0.0: only the surplus is rejected | Only files beyond the limit get `MAX_FILES`; Zag rejects the whole batch |
| Zag | [#1903](https://github.com/chakra-ui/zag/issues/1903) closed | Single mode: an invalid file removes the accepted one | Replace with `[]` | Keep the accepted file | Replace only with an accepted file |
| Zag | [#2513](https://github.com/chakra-ui/zag/issues/2513) closed | `setFiles` stored `[undefined]` | No length check | Guard | Typed value, no holes |
| Kobalte | [#571](https://github.com/kobaltedev/kobalte/issues/571) open; Zag [#1566](https://github.com/chakra-ui/zag/issues/1566), [#2700](https://github.com/chakra-ui/zag/issues/2700) closed | Change callback shape differs on add and delete; reject callback on delete | Several write paths | Fixed (Zag) / open | One `onFilesChange(files, details)` with the whole list and a `reason`; `onReject` only for a gesture's refusals |
| Zag | [#2172](https://github.com/chakra-ui/zag/issues/2172) closed | Rejected files could not be dismissed | Delete filtered accepted only | Typed delete | `clearRejections()`; rejections end with the next gesture |
| Zag | [#2902](https://github.com/chakra-ui/zag/issues/2902) closed | Pasted files skipped validation | Separate paste path | Same pipeline | Every source sends one `FILES.ADD` through one validation |
| Zag | [#2252](https://github.com/chakra-ui/zag/issues/2252), [#1871](https://github.com/chakra-ui/zag/issues/1871) closed; RA [#4963](https://github.com/adobe/react-spectrum/issues/4963), [#7185](https://github.com/adobe/react-spectrum/issues/7185) closed | Folder drop gives only the folder; `directory` had no effect | No traversal; no `webkitdirectory` | Recursive `readEntries`; attribute | `directory`: attribute + traversal; without it a folder is refused, not silently dropped |
| react-dropzone | [rd#1435](https://github.com/react-dropzone/react-dropzone/issues/1435), [fs#130](https://github.com/react-dropzone/file-selector/issues/130), [fs#120](https://github.com/react-dropzone/file-selector/issues/120) closed | Archive drops fail; Edge folder drop loses everything | Item neutered after `await`; `readEntries` throws; one failure rejects all | Sync `getAsFile`; handles; null guard | Read entries synchronously in `drop`; one failing entry is a rejection, not a lost drop |
| RA | source (Mozilla 1699743) | Firefox file paste adds a ghost `image/png` item | Engine bug | Skip null items | `filesFromClipboard` reads `files` first and skips null items |
| Kobalte | source | `dragleave` over children flickers | Boolean state | — | Entered-element set |
| Zag | source; RA source (WebKit 66547) | `relatedTarget` containment fails in Safari | `relatedTarget` is `null` on `dragleave` in WebKit | RA: `Set`; react-dropzone: array | Entered-element set with pruning; replaces `dragLeftRoot` (also used by Prompt Input) |
| react-dropzone | [rd#668](https://github.com/react-dropzone/react-dropzone/issues/668), [#1244](https://github.com/react-dropzone/react-dropzone/issues/1244), [#1418](https://github.com/react-dropzone/react-dropzone/issues/1418), [#1408](https://github.com/react-dropzone/react-dropzone/issues/1408), [#1415](https://github.com/react-dropzone/react-dropzone/issues/1415) closed | Reject style never in Safari; reject shown then file accepted; validator crash mid-drag; reject state stuck | No names or sizes during a drag; Safari no types | `isDragUnknown` | No accept/reject verdict during a drag: `data-dragging` only |
| react-dropzone | [rd#1409](https://github.com/react-dropzone/react-dropzone/issues/1409) closed | Image drag reports only `text/plain` in `types` | Chromium inconsistency | Also check `items[].kind === "file"` | `dragHasFiles` checks `types` and item kinds |
| Zag | [#3387](https://github.com/chakra-ui/zag/issues/3387) closed; Ark [#3249](https://github.com/chakra-ui/ark/issues/3249); react-dropzone [rd#182](https://github.com/react-dropzone/react-dropzone/issues/182), [#1432](https://github.com/react-dropzone/react-dropzone/issues/1432) | Chooser opens twice | A `label` (or the input's own click) inside a clickable zone | Usage note / `noClick` | The zone's press ignores presses from labels, the input and interactive children; the Label has no `for` |
| RA | [#5394](https://github.com/adobe/react-spectrum/issues/5394) open | Dead tab stop in the drop zone | Hidden button for AT | Open | Drop zone is not focusable |
| RA | [#6230](https://github.com/adobe/react-spectrum/issues/6230) closed | Drop zone submits the form | Button without `type` | `type="button"` | Trigger and Remove buttons are `type="button"` |
| RA | [#10092](https://github.com/adobe/react-spectrum/issues/10092) closed | Opening the chooser scrolls a panel | Synthetic input click bubbled; hidden button focused | Discussion | Input click does not bubble into the zone; nothing hidden is focused |
| RA | [#5938](https://github.com/adobe/react-spectrum/issues/5938) closed | No way to disable the drop zone | Missing prop | `isDisabled` | `disabled` stops drop, paste and chooser |
| Kobalte | [#583](https://github.com/kobaltedev/kobalte/issues/583) open | Want drop without click-to-open | Unconditional click | `preventDefault` in `onClick` | Consumer `onClick` with `preventDefault` wins |
| Headless UI | [#3680](https://github.com/tailwindlabs/headlessui/issues/3680) closed | Label click does not open a file input | Synthetic `.click()` path | #3707 | Label presses focus the Trigger (Slider's rule); no surprise chooser |
| react-dropzone | [rd#408](https://github.com/react-dropzone/react-dropzone/issues/408), [#922](https://github.com/react-dropzone/react-dropzone/issues/922), [#935](https://github.com/react-dropzone/react-dropzone/issues/935) closed | Not keyboard reachable; input `display:none` invisible to AT | No tab stop | `tabIndex` on root | A real button is the tab stop |
| react-dropzone | rd#1268, rd#1413, rd#1553 (source comments) | `required` broken; page scrolls; Safari widens parent | `display:none`; `position:absolute`; width | Zero-size in-flow input | `hidden-form-input` style (fixed, 1×1, clipped) |
| RA | [#7746](https://github.com/adobe/react-spectrum/issues/7746) closed | `aria-*` on the input ignored | `display:none` | Not a bug | The input is `aria-hidden`; ARIA goes on the Trigger |
| Zag | [#1819](https://github.com/chakra-ui/zag/issues/1819) closed | `aria-invalid` wrong | Derived from rejected files | Explicit `invalid` | Invalid from Field / prop only |
| react-dropzone | [rd#1455](https://github.com/react-dropzone/react-dropzone/issues/1455) closed | Drop accepted while the chooser is open | Handlers live | Guard | Not needed: both results are files the user chose; noted |
| react-dropzone | [rd#1245](https://github.com/react-dropzone/react-dropzone/issues/1245), [#1282](https://github.com/react-dropzone/react-dropzone/issues/1282), [#1429](https://github.com/react-dropzone/react-dropzone/issues/1429), [#1294](https://github.com/react-dropzone/react-dropzone/issues/1294) closed | FS Access picker: no folders, blocked in Edge, nothing in Firefox | Chromium-only API, policies | Fallbacks | Native input only |

## Known pitfalls

1. **Two sources of truth** for the files: the component list and `input.files` (ZG#2120,
   rd#880, Kobalte, RA#6835). The value is the only source, and the input mirrors it after
   every change, once per gesture (ZG#3330).
2. **Empty or platform-specific MIME types**: `.mov`, `.heic`, `.docx`, `.md` with `type`
   `""`, and CSV that differs by OS (ZG#2571, fs#3, rd#1285, rd#1418). Use an extension
   fallback, and tell consumers to list extensions.
3. **`accept` is a hint**: the chooser's "All files" option and the FS Access picker ignore
   it (RA#8078, rd#1285). Every path validates.
4. **Drag state**: `relatedTarget` is `null` in WebKit, Firefox repeats enter/leave, and a
   boolean flickers. Nothing about the files is readable before `drop`, and Safari exposes no
   types (rd#668). Track entered elements and give no verdict while dragging.
5. **DataTransfer lifetime**: read items synchronously inside `drop`, before any `await`
   (rd#1435, RA `readFromDataTransfer`).
6. **Same file again**: unchanged selection fires no `change` (KB#573, RA#4925, Zag #869).
7. **Count rules**: per batch vs total, whole batch vs surplus (KB#572, rd#1358, Zag).
8. **Double open**: a label or nested trigger inside a clickable zone (ZG#3387, rd#182).
9. **Fake buttons**: a drop zone `role="button"` or a hidden button gives a second or dead
   tab stop, an English name, or a form submit (Zag, Kobalte, RA#5394, RA#6230).
10. **Object URLs** for previews leak unless revoked (Zag `createFileUrl`, Prompt Input
    note).

## Testing notes

- **Machine in Node**: files are plain `{ name, type, size }` records, so validation, count,
  duplicates, replacement and the controlled write path all run without a DOM.
- **Drop and paste**: synthesise `DragEvent` / `ClipboardEvent` with a real `DataTransfer` in
  browser mode (Chromium, Firefox, WebKit). Drive `dragenter` on the zone, then on a child,
  then `dragleave` from the zone with `relatedTarget: null` (the WebKit shape), then `drop` on
  the child. `data-dragging` must hold throughout. jsdom has no `DataTransfer`: the DOM
  adapter builds an event carrying a `dataTransfer` reader, as it does for `paste(text)`.
- **Chooser**: `setFiles` exists in the env (Playwright `setInputFiles`). Keyboard path: focus
  the Trigger, press Enter, then `setFiles`. In Playwright, `page.waitForEvent("filechooser")`
  proves the chooser opened.
- **Directories**: `webkitGetAsEntry` cannot be built by script. A browser test injects a
  fake entry tree through the drop source abstraction; the traversal function is unit-tested
  with fake entries (batches of 100, an entry that throws).
- **Form**: submit `FormData` and assert the names; `form.reset()`; `required` +
  `checkValidity()`; a disabled fieldset.
- **New env primitives**: `dropFiles(files)` (dragenter, dragover, drop on the part, with an
  optional child target) and `pasteFiles(files)` (paste on the focused element). Both take
  the existing serialisable `FileSpec`.
- **Announcements**: a recording Announcer; exactly one per gesture per kind.
- **Driver** `getFileUpload(screen, { name })`:
  - actions: `choose(files)`, `drop(files)`, `dragEnter()`, `dragLeave()`, `paste(files)`,
    `remove(name)`, `clear()`, `resetForm()`;
  - queries: `files()`, `rejections()` → `{ name, reason }[]`, `isDragging()`,
    `formFiles()`, `summary()`, `isDisabled()`, `isInvalid()`, `isRequired()`.

## Decisions

- **Control**: a `Trigger` `<button type="button">` is the only tab stop that opens the
  chooser. A native `<input type="file">` is the form carrier and the chooser: `aria-hidden`,
  `tabindex=-1`, the `hidden-form-input` style (never `display:none`), with `name`, `form`,
  `accept`, `multiple`, `capture`, `webkitdirectory`, `required`, `disabled`. Its validity is
  the Field's. Its focus forwards to the Trigger.
- **Drop zone**: a `div` with no role and no `tabindex`. It accepts file drags, and a pointer
  press on its own area opens the chooser. Presses from interactive descendants, labels and
  the input are ignored, and a consumer `preventDefault` turns the press off (KB#583). A dev
  warning fires when no Trigger is rendered.
- **Parts**: `Root` (`div`), `Label` (`label`, no `for`; a press focuses the Trigger),
  `Dropzone`, `Trigger`, `HiddenInput` (rendered by Root), `ItemGroup` (`ul`), `Item` (`li`),
  `ItemName`, `ItemSize` (locale-formatted), `ItemPreview` (`img`; creates and revokes an
  object URL; renders nothing for non-images), `ItemRemove` (`button` "Remove *name*"),
  `ClearTrigger` (`button`, "Remove all files"). Description and ErrorMessage come from Field.
- **Value**: a controllable `files` list (`files` / `defaultFiles` (`[]`) /
  `onFilesChange(files, details)`), `details.reason` `add | remove | clear | reset | api`.
  Generic over `F extends FileLike = File` (`{ name, type, size }`), so an injected drop
  source can deliver non-`File` records (for example Tauri paths). Only real `File`s reach
  `input.files`. Identity is the object; duplicates are checked by name + size + type.
- **Intake**: every source (chooser, drop, paste, API `addFiles`) sends one `FILES.ADD`
  `{files, source}` per gesture, through one validation.
  - Order of checks per file: directory without `directory` (`DIRECTORY`), `accept`
    (`ACCEPT`), `minFileSize` (`MIN_SIZE`), `maxFileSize` (`MAX_SIZE`), duplicate
    (`DUPLICATE`), `validate(file, {files})` returning a code (`CUSTOM` + `code`), then the
    count (`MAX_FILES`).
  - One reason per rejection (the first that fails), so the announcement is one sentence.
    This extends prompt-input's `FileRejection` with `code?`.
  - `maxFiles` (default 1) counts against the total. Only the surplus is rejected. With
    `maxFiles` 1, an accepted file replaces the current one, and a gesture with no accepted
    file keeps it.
  - `accept` takes the native grammar or an array. Matching falls back to a small
    extension → MIME table when `type` is empty.
- **Machine** (`file-upload.machine.ts`):
  - States `idle`, `dragging`.
  - Events `DRAG.ENTER`, `DRAG.LEAVE`, `FILES.ADD {files, source}`, `FILE.REMOVE {file}`,
    `FILES.CLEAR`, `REJECTIONS.CLEAR`, `PICKER.OPEN`, `RESET`, `VALUE.SYNCED`.
  - Context `rejections` (the last gesture's) and `pending` (an unanswered controlled
    proposal).
  - Effects: open the picker, announce, sync the input, prevent document drops.
- **Drag tracking**: a set of entered elements in `core/dom/file-intake` (`dragPresence`).
  `dragenter` adds the target and `dragleave` deletes it. Detached targets are pruned. The
  drag ends when the set is empty, on `drop`, or on a document `drop` / `dragend`. This
  replaces `dragLeftRoot`, which relies on `relatedTarget` (null in WebKit). Prompt Input
  moves to it as well, since it is the second user. There is no accept/reject verdict while
  dragging.
- **Directories**: `directory` sets `webkitdirectory` and makes a drop traverse
  `webkitGetAsEntry()` entries. Items are read synchronously, then `readEntries` loops until
  it gets an empty batch. An entry that throws becomes a rejection. Each file's relative path
  is kept for `filePath(file)`. Without `directory`, a dropped folder is rejected with
  `DIRECTORY`.
- **Drop source** (injected, a plus for Reado/Tauri): `dropSource(zone, sink)` with
  `sink.enter()`, `sink.leave()`, `sink.drop(files)`. The default is the DOM source above. A
  Tauri source subscribes to the window's OS drag events, hit-tests the zone, and delivers
  records with a path.
- **Document drops**: `preventDocumentDrop` (default true) prevents `dragover` / `drop` of
  files on the document while an enabled File Upload is mounted (one shared listener with a
  reference count), so a missed drop does not navigate the tab.
- **Form**: the input mirrors the value after every change, with one `DataTransfer` per
  gesture. That alone makes "pick, remove, pick again" work.
  - User changes dispatch `input` + `change` on it.
  - A `change` from the chooser with zero files (cancel) is ignored and the input re-synced.
  - Form reset restores the current `defaultFiles`.
  - `required` gives a native `valueMissing`.
  - Fieldset disabling applies. Inside a Field it registers as one control.
- **Announcements**: added (polite), rejected (assertive), removed (polite), cleared
  (polite), once per gesture. Message keys and defaults are shared with Prompt Input
  (`rejectedAnnouncement(name, reason)`, `rejectedCountAnnouncement(n)`,
  `removedAnnouncement(name)`); new keys `addedAnnouncement`, `addedCountAnnouncement`,
  `clearedAnnouncement`, `summary`, `triggerLabel`, `removeLabel`, `clearLabel`,
  `itemGroupLabel`.
- **`data-*`**: Root, Dropzone and Trigger carry `data-dragging`, `data-disabled`,
  `data-readonly`, `data-required`, `data-invalid` and `data-empty`. Items carry
  `data-index`. Focus attributes go on the Trigger.
- **Contract**: locate by role `button` + name (the Trigger). Actions and queries are listed
  under Testing notes. Traits `form-associated`, `field-associated`.
- **Theme**: `file-upload.css`, family `field` (`outline`, `soft`). Dashed zone border, solid
  plus `Highlight` while dragging, ≥ 24 px buttons, a list of items, logical properties.
- **Deliberately different**:
  - No `role="button"` drop zone and no hidden button. One real Trigger.
  - Form sync, reset and Field integration are built in. No other library has all three.
  - Announcements are built in.
  - Paste is built in.
  - Surplus-only `MAX_FILES`.
  - No drag-time accept/reject verdict.
  - Entered-set drag tracking instead of `relatedTarget`.
  - Rejections do not make the field invalid.
  - No `showOpenFilePicker`.
  - No `transformFiles`: the consumer transforms in `onFilesChange`.

## Open questions

- **Upload progress and per-file status** (uploading, failed, retry): out of the first
  change. Consumers render a Progress inside an Item. Revisit if a `status` per item is
  asked for, because it would need announcements.
- **Rejected files as items**: rejections live in the render state (`rejections`) for the
  consumer to show. Should a `RejectionGroup` part render them?
- **Image previews**: does an `ItemPreview` that creates object URLs belong in core, or
  should it be a docs recipe? It is shipped because the leak is easy to get wrong.
- **Large drops**: a 25k-file drop runs validation once and builds one `DataTransfer`.
  Should it be chunked or yield to the event loop? Measure in the browser suite.
- **iOS Safari**: `webkitdirectory` is unsupported there. Should the Trigger hide the folder
  option, or leave the platform to decide? Check in the manual protocol.
