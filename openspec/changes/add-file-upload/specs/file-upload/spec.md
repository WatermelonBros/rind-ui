## ADDED Requirements

### Requirement: Anatomy

A File Upload SHALL consist of `Root`, `Label`, `Dropzone`, `Trigger`, and, while files are
held, `ItemGroup` with one `Item` per file (`ItemName`, `ItemSize`, `ItemPreview`,
`ItemRemove`), and `ClearTrigger`.

- `Root` SHALL render, after its children, exactly one native `<input type="file">` (the file
  input) and one visually hidden selection summary.
- The file input SHALL carry `aria-hidden="true"`, `tabindex="-1"` and the
  `hidden-form-input` visually hidden style (never `display: none`).
- `Trigger` SHALL be a `<button type="button">`. It SHALL be the File Upload's only control
  that opens the chooser from the keyboard.
- `Dropzone` SHALL have no role and no `tabindex`.
- `ItemRemove` and `ClearTrigger` SHALL be `<button type="button">`.
- Every part SHALL accept the `render` prop.

#### Scenario: One button, no fake drop button (react-spectrum#5394, zag#3387)

- **WHEN** a File Upload labelled "CV" with a Dropzone containing a Trigger "Choose file" is
  rendered
- **THEN** exactly one element is focusable, and it is a `button` named "CV, Choose file"
- **AND** the Dropzone has no role and no `tabindex`
- **AND** the file input is `aria-hidden` with `tabindex="-1"`

#### Scenario: No form submit from the component's buttons (react-spectrum#6230)

- **WHEN** a File Upload inside a form is activated with Enter on the Trigger, on a Remove
  button and on ClearTrigger
- **THEN** the form is not submitted

### Requirement: Value

The File Upload SHALL expose a controllable list `files` (default `defaultFiles`, default
`[]`) with `onFilesChange(files, details)`. `details` SHALL carry `reason` (`add`, `remove`,
`clear`, `reset` or `api`), `event` and `cancel()`. It SHALL be generic over the file record
type `F extends { name: string; type: string; size: number }`, with `File` as the default.

- Every change SHALL go through one write path that reports the whole new list.
- A controlled File Upload whose parent does not apply a proposal SHALL keep its value and
  re-sync its file input.
- A change of `defaultFiles` SHALL not change the current value.

#### Scenario: Whole list on every change (kobalte#571)

- **WHEN** "a.pdf" is added to a File Upload holding "b.pdf", then "b.pdf" is removed
- **THEN** `onFilesChange` receives `["b.pdf", "a.pdf"]` with reason `add`, then `["a.pdf"]`
  with reason `remove`

#### Scenario: Controlled refusal

- **WHEN** a controlled File Upload holding nothing receives a chosen file and the parent does
  not apply the new list
- **THEN** no Item is rendered and the file input holds no file

### Requirement: Choosing Files

Activating `Trigger` SHALL open the native chooser of the file input in the same task as the
activation.

- The file input SHALL carry `accept` (the `accept` prop, joined when it is an array),
  `multiple` when `maxFiles` is not 1, `capture` when set, and `webkitdirectory` when
  `directory` is set.
- A chooser selection SHALL be added as one gesture.
- A `change` that carries no file (a cancelled chooser) SHALL change nothing, and the input
  SHALL be re-synced to the value.
- The file input's click SHALL not propagate into the Dropzone.
- A press on `Label` SHALL focus the Trigger without opening the chooser.

#### Scenario: Keyboard opens the chooser

- **WHEN** the Trigger is focused and Enter is pressed
- **THEN** the system file chooser opens (Playwright `filechooser`) for the file input

#### Scenario: Pick, remove, pick again (kobalte#573, react-spectrum#4925)

- **WHEN** a user chooses "a.txt", removes it, and chooses "a.txt" again
- **THEN** "a.txt" is held again

#### Scenario: Cancel keeps the files

- **WHEN** a File Upload holds "a.txt" and the chooser reports a `change` with no file
- **THEN** it still holds "a.txt" and the file input still carries it

### Requirement: Dropping Files

The Dropzone SHALL accept drags whose data carries files (`dataTransfer.types` includes
`"Files"`, or an item of kind `file`). Other drags SHALL be ignored.

- While such a drag is over the Dropzone or any descendant, the File Upload SHALL be in state
  `dragging`.
- The drag SHALL be tracked by the set of entered elements, never by `relatedTarget`: entering
  a descendant and leaving the Dropzone in any order SHALL keep `dragging` until no entered
  element remains, a drop happens, or the drag ends on the document.
- `dragover` SHALL prevent the default and set `dropEffect` to `copy`, or to `none` while
  disabled or read-only.
- A drop SHALL add its files as one gesture.
- Items SHALL be read synchronously inside the `drop` event.
- No accept or reject verdict SHALL be shown while dragging.
- A pointer press with the primary button on the Dropzone's own area SHALL open the chooser.
  A press whose target is inside an interactive element, a `label` or the file input SHALL
  not open it, and neither SHALL a press whose `click` default was prevented by the consumer.

#### Scenario: No flicker over children in WebKit (WebKit 66547, kobalte source)

- **WHEN** a file drag enters the Dropzone, enters a child, and a `dragleave` with
  `relatedTarget: null` fires on the Dropzone
- **THEN** the Root and Dropzone keep `data-dragging`, and dropping on the child adds the file
  once

#### Scenario: No double open (zag#3387, react-dropzone#182)

- **WHEN** a Dropzone contains the Trigger and a `label`, and each is pressed
- **THEN** the chooser opens once for the Trigger press and not for the label press

#### Scenario: Missed drop does not navigate

- **WHEN** `preventDocumentDrop` is left at its default and a file is dropped on the page
  outside the Dropzone
- **THEN** the document's `drop` default is prevented and nothing is added

### Requirement: Pasting Files

While focus is inside the Root, a `paste` whose clipboard holds files (`clipboardData.files`,
else `items` of kind `file` with a non-null file) and no non-empty `text/plain` SHALL add
those files as one gesture and prevent the paste's default. Other pastes SHALL be left to the
platform.

#### Scenario: Paste a screenshot on the Trigger (zag#2902)

- **WHEN** the Trigger is focused and a clipboard image is pasted, with `accept="image/*"`
- **THEN** the image is held, after the same validation as a chosen file

### Requirement: File Validation

Every gesture, whatever its source, SHALL be validated once. Each file SHALL be checked in this
order, and the first failing check SHALL be its rejection reason:

1. a folder without `directory` (`DIRECTORY`);
2. `accept` (`ACCEPT`);
3. `minFileSize` (`MIN_SIZE`);
4. `maxFileSize` (`MAX_SIZE`);
5. a file with the same name, size and type already held or earlier in the gesture
   (`DUPLICATE`);
6. `validate(file, { files })` returning a code (`CUSTOM`, with that `code`).

The count SHALL then be applied (`MAX_FILES`):

- With `maxFiles` 1 (the default), the first accepted file SHALL replace the held file, and
  any further accepted files SHALL be rejected.
- Otherwise only the accepted files beyond `maxFiles` minus the held count SHALL be rejected.
- A gesture with no accepted file SHALL leave the value unchanged.

`accept` SHALL use the native grammar (MIME types, `type/*`, `.ext`, comma-separated or an
array, case-insensitive). When a file's `type` is empty, it SHALL fall back to the MIME type
of its extension. Sizes are in bytes, and 0-byte files SHALL be checked like any other.

#### Scenario: Empty type falls back to the extension (zag#2571)

- **WHEN** `accept="video/*"` and "clip.mov" arrives with an empty `type`
- **THEN** "clip.mov" is held

#### Scenario: Only the surplus is refused (kobalte#572, react-dropzone#1358)

- **WHEN** a File Upload with `maxFiles={3}` holds one file and four valid files are dropped
- **THEN** the first two are held, and the last two are rejected with `MAX_FILES`

#### Scenario: Single file replaced, kept on rejection (zag#1903)

- **WHEN** a File Upload with `maxFiles={1}` and `accept=".pdf"` holds "a.pdf", "b.pdf" is
  chosen, and then "c.png" is chosen
- **THEN** it holds "b.pdf" after the first choice and still "b.pdf" after the second, with
  "c.png" rejected as `ACCEPT`

#### Scenario: Duplicate (zag#3048)

- **WHEN** a File Upload with `maxFiles={5}` holds "a.pdf" and the same "a.pdf" is dropped
- **THEN** it holds one "a.pdf" and the drop's file is rejected with `DUPLICATE`

### Requirement: Rejections

The rejections of the last gesture SHALL be exposed in the render state as `{ file, reason,
code? }[]` and SHALL be passed once to `onReject(rejections)`. They SHALL be replaced by the
next gesture's and cleared by a reset or by `clearRejections()`. Rejections SHALL never set
`aria-invalid` or `data-invalid`: the files already held stay valid.

#### Scenario: Mixed gesture (vercel/ai-elements#511)

- **WHEN** `maxFileSize` is 1 MB and "small.png" (10 KB) and "huge.mov" (2 GB) are dropped
  together
- **THEN** "small.png" is held, `onReject` receives "huge.mov" with `MAX_SIZE`, and the
  Trigger has no `aria-invalid`

### Requirement: Removing Files

`ItemRemove` SHALL remove its file through one `onFilesChange` call (reason `remove`), and
`ClearTrigger` SHALL remove every file (reason `clear`). A second removal request for a file no
longer held SHALL do nothing.

Focus SHALL move:

- after a removal, to the next Item's Remove button, else the previous Item's, else the
  Trigger;
- after a clear, to the Trigger;
- never to `<body>`.

Read-only and disabled File Uploads SHALL not remove files.

#### Scenario: Focus after removing the last item

- **WHEN** a File Upload holds "a.pdf" and "b.pdf" and the user presses "Remove b.pdf"
- **THEN** it holds "a.pdf" and focus is on "Remove a.pdf"; pressing it moves focus to the
  Trigger

### Requirement: Directories

With `directory`:

- the file input SHALL carry `webkitdirectory`;
- a dropped folder SHALL be traversed, reading each directory until an empty batch is
  returned;
- every file SHALL be added in the same gesture with its relative path available through
  `filePath(file)`;
- an entry that cannot be read SHALL be rejected (`CUSTOM`, code `unreadable`) without losing
  the rest of the drop.

Without `directory`, a dropped folder SHALL be rejected with `DIRECTORY`.

#### Scenario: More than one batch (zag#2252)

- **WHEN** a folder whose reader returns 100 entries, then 30, then none is dropped on a File
  Upload with `directory` and no `maxFiles` limit
- **THEN** 130 files are held, each with its path under the folder

#### Scenario: Folder without directory

- **WHEN** a folder is dropped on a File Upload without `directory`
- **THEN** nothing is held and the folder is rejected with `DIRECTORY`

### Requirement: Drop Source

The Dropzone SHALL receive drags through an injectable `dropSource(zone, sink)` that calls
`sink.enter()`, `sink.leave()` and `sink.drop(files, refused?)` and returns a disconnect
function. The default SHALL be the DOM source of Requirement: Dropping Files. Files that are
not `File` objects SHALL be held and validated like any other, and SHALL not be written to the
file input.

#### Scenario: OS-level drop (Tauri)

- **WHEN** a custom source delivers `{ name: "a.png", type: "image/png", size: 10, path:
  "/tmp/a.png" }` to a File Upload with `accept="image/*"`
- **THEN** it is held with its `path`, `data-dragging` followed the source's enter and leave,
  and the file input holds no file

### Requirement: Form Participation

The file input SHALL carry `name`, `form`, `required` and `disabled`, and SHALL hold exactly
the held `File`s after every change, synced once per gesture through a `DataTransfer`.

- A user change SHALL dispatch `input` and `change` on it. A parent's change or a reset SHALL
  not.
- With `required`, the form SHALL be invalid while no file is held (`valueMissing`), and
  focus moved to the file input by validation SHALL move to the Trigger with
  `data-focus-visible`.
- A form reset SHALL restore the current `defaultFiles` and clear the rejections.
- A disabled fieldset SHALL disable the File Upload.
- Inside a Field, the File Upload SHALL register as one control: validity element the file
  input, focus target the Trigger, labelled by the Field's Label.

#### Scenario: Dropped files are submitted (react-dropzone#880, react-spectrum#6835)

- **WHEN** a File Upload named "docs" with `maxFiles={5}` receives "a.pdf" by drop and
  "b.png" by paste, and its form is submitted
- **THEN** `FormData.getAll("docs")` holds both files

#### Scenario: Reset

- **WHEN** a user drops "a.pdf" on an uncontrolled File Upload and its form is reset
- **THEN** no file is held, no Item is rendered, and no `change` was dispatched by the reset

#### Scenario: Required

- **WHEN** a required File Upload with no file is in a form that is submitted
- **THEN** submission is cancelled, the file input reports `valueMissing`, and focus is on the
  Trigger

### Requirement: Disabled And Read-Only

`disabled` SHALL disable the Trigger, the file input (not submitted), the Remove and Clear
buttons, drops (`dropEffect` `none`), paste and the Dropzone press. `readOnly` SHALL keep the
Trigger focusable with `aria-disabled="true"`, keep the held files submitted, and ignore
chooser opening, drops, paste and removal.

#### Scenario: Disabled ignores a drop (react-spectrum#5938)

- **WHEN** a file is dropped on a disabled File Upload
- **THEN** nothing is held, nothing is announced, and the Root has no `data-dragging`

### Requirement: Naming And Description

- The Trigger SHALL be named by the Label (the File Upload's own Label, or the Field's)
  followed by its own content, through `aria-labelledby`.
- Its `aria-describedby` SHALL start with the selection summary, then the Field's description
  and error.
- The summary SHALL read `messages.summary({ count, names })`: default "No file chosen" for
  none, the name for one, "N files" for more, with the count formatted for the locale.
- The Trigger SHALL carry `aria-invalid="true"` only while the Field or the `invalid` prop
  says so.
- `ItemGroup` SHALL be a list named `messages.itemGroupLabel` ("Selected files").
- Each `ItemRemove` SHALL be named `messages.removeLabel(name)` ("Remove {name}") and
  `ClearTrigger` `messages.clearLabel` ("Remove all files").
- `ItemSize` SHALL format bytes for the locale.
- `ItemPreview` SHALL render an `img` with `alt=""` for image `File`s only, and SHALL revoke
  its object URL when unmounted or when its file changes.

#### Scenario: Native-like description

- **WHEN** a File Upload labelled "Photos" with a Trigger "Choose files" holds "a.png" and
  "b.png"
- **THEN** the Trigger is named "Photos, Choose files" and described as "2 files"

#### Scenario: Preview URL revoked

- **WHEN** an Item with an `ItemPreview` for "a.png" is removed
- **THEN** the object URL it created has been revoked

### Requirement: Announcements

The File Upload SHALL announce through the injected Announcer only, once per gesture:

- added files, polite: `addedAnnouncement(name)` ("{name} added") or
  `addedCountAnnouncement(n)` ("{n} files added");
- rejected files, assertive: `rejectedAnnouncement(name, reason)` for one or
  `rejectedCountAnnouncement(n)` for several, with the same keys and defaults as Prompt Input
  plus defaults for `MIN_SIZE`, `DUPLICATE`, `DIRECTORY` and `CUSTOM`;
- a removal, polite: `removedAnnouncement(name)`;
- a clear, polite: `clearedAnnouncement`.

It SHALL announce nothing while dragging, nothing for a parent's change or a reset, and SHALL
render no live region of its own.

#### Scenario: One announcement per gesture

- **WHEN** three accepted files are dropped
- **THEN** "3 files added" is announced once, politely

#### Scenario: Added and rejected in one drop

- **WHEN** a drop adds "a.png" and rejects "b.exe" for `ACCEPT`
- **THEN** "a.png added" is announced politely and "b.exe is not an accepted file type"
  assertively

### Requirement: Data Attributes

Every part SHALL carry:

- `data-scope="file-upload"`, `data-part` and `data-instance`;
- `data-disabled`, `data-readonly`, `data-required`, `data-invalid` and `data-dragging` while
  they apply;
- `data-empty` while no file is held.

The Trigger SHALL carry `data-focus` and `data-focus-visible`. Each Item and its sub-parts
SHALL carry `data-index`.

#### Scenario: Dragging state on the parts

- **WHEN** a file drag is over the Dropzone
- **THEN** Root, Dropzone and Trigger carry `data-dragging`, and lose it after the drop

### Requirement: Contract

The File Upload SHALL ship `fileUploadContract`, located by role `button` and accessible name
(the Trigger), and a `getFileUpload` driver.

- Actions:
  - `choose(files)` (pointer: click the Trigger; keyboard: focus and Enter; both then set the
    file input's files);
  - `drop(files, { over? })`;
  - `dragEnter()`, `dragLeave()`;
  - `paste(files)`;
  - `remove(name)`, `clear()`;
  - `resetForm()`.
- Queries: `files`, `rejections`, `isDragging`, `formFiles`, `summary`, `isDisabled`,
  `isInvalid`, `isRequired`.
- Traits: `form-associated` and `field-associated`.
- The env SHALL gain `dropFiles(files, { over? })` and `pasteFiles(files)`, implemented by the
  DOM and Playwright adapters.

#### Scenario: Same driver test in jsdom and a browser

- **WHEN** `getFileUpload(screen, { name: "CV, Choose file" }).drop([{ name: "cv.pdf", type:
  "application/pdf", content: "x" }])` runs in jsdom and in Chromium
- **THEN** both report `files()` as `["cv.pdf"]` and `summary()` as "cv.pdf"

### Requirement: File Upload Invariants

After every model step:

- the Items SHALL match the value, in order;
- where `DataTransfer` exists, the file input's files SHALL equal the held `File`s;
- the File Upload SHALL have exactly one Trigger, and the Dropzone SHALL not be focusable;
- focus, when it was inside the File Upload, SHALL remain inside it;
- `data-dragging` SHALL be present only in state `dragging`.

#### Scenario: Model walk

- **WHEN** `testMachine(fileUploadContract, …)` walks every transition in every configuration
  in Chromium, Firefox and WebKit
- **THEN** every invariant holds after every step

### Requirement: Theme

`@rind-ui/theme` SHALL ship `file-upload.css` in `@layer rind.components` with `:where()`
selectors, family `field` (`outline`, `soft`; sizes `sm`, `md`, `lg`).

- The Dropzone SHALL draw a dashed border that becomes solid with the accent tint while
  `data-dragging`.
- Remove and Clear buttons SHALL be at least 24 × 24 CSS px.
- Under forced colors the border SHALL use system colours (`CanvasText`, and `Highlight`
  while dragging).
- Transitions SHALL be off under reduced motion.
- The sheet SHALL use logical directions only.

#### Scenario: Dragging reads by shape

- **WHEN** a File Upload styled by `file-upload.css` is dragged over under `forced-colors:
  active`
- **THEN** the Dropzone border changes from dashed to solid
