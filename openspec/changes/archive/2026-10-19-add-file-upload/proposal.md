## Why

File Upload ships in Zag/Ark, React Aria (DropZone + FileTrigger) and Kobalte, and
react-dropzone is the de facto hook. Their bug history keeps returning to the same problems:

- the file list and `input.files` disagree, so dropped files never reach the form, and
  React Aria has no form support at all;
- the same file cannot be picked again;
- `accept` rejects valid files whose `type` is empty;
- `maxFiles` is counted per batch;
- the drag state flickers over children, and Safari breaks `relatedTarget`;
- drop zones are fake buttons with an English name, or a dead tab stop;
- the chooser opens twice;
- rejected files are never announced.

A real Trigger button over the native file input, one validation pipeline for every source,
and an input that always mirrors the value fix most of these by construction.

Research: [file-upload](../../../docs/research/file-upload.md) ·
[prompt-input](../../../docs/research/prompt-input.md) (file intake) ·
[accessibility](../../../docs/research/accessibility.md) §2, §4, §7, rules 11, 21, 23 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
causes A, J, K · [native-platform](../../../docs/research/native-platform.md)

Depends on: `add-foundations`, `add-a11y-foundations` (announcer, modality, visually hidden
style), `add-checkbox` (`hidden-form-input`), `add-field` (`field-control`,
`field-validation`), `add-theme-system`, `add-prompt-input` (`core/dom/file-intake.ts`,
`components/shared/file-validation.ts`, the env `setFiles` primitive, shared rejection
messages).

## What Changes

- A public **File Upload** in `@rind-ui/core` (machine, connect, contract, messages, meta)
  and `@rind-ui/react` (parts `Root`, `Label`, `Dropzone`, `Trigger`, `ItemGroup`, `Item`,
  `ItemName`, `ItemSize`, `ItemPreview`, `ItemRemove`, `ClearTrigger`; Root renders the
  native file input).
- A controllable `files` list. Files come from the system chooser, from a drop and from a
  paste, and each source goes through one validation: `accept` (native grammar plus an
  extension fallback), `minFileSize`, `maxFileSize`, duplicates, `validate`, and `maxFiles`
  counted against the total.
- Rejections are reported and announced.
- Removing one file or all of them, with focus kept in the component.
- Directory pick and drop (`directory`).
- An injectable drop source, so OS-level drops such as Tauri's can be used.
- Document drops are prevented.
- Form participation: `name`, `form`, `required`, reset, fieldset, Field.
- Shared infrastructure, generalised for its second user:
  - `file-intake` gains the entered-element drag tracker (it replaces `dragLeftRoot`,
    which fails in WebKit; Prompt Input moves to it), directory traversal, and a cancel-safe
    input sync.
  - `file-validation` gains `MIN_SIZE`, `DUPLICATE`, `DIRECTORY` and `CUSTOM` reasons, the
    extension fallback, and array `accept`.
  - The env gains `dropFiles` and `pasteFiles`.
- `getFileUpload` driver, model-based tests, `file-upload.css` (family `field`), site example
  and skin, docs page.

## Capabilities

### New Capabilities

- `file-upload`: the File Upload component. It covers anatomy, the value, the three intake
  paths, validation and rejections, removal, directories, the drop source, form
  participation, ARIA and naming, announcements, data attributes, contract, invariants and
  theme.

### Modified Capabilities

None. Prompt Input keeps its requirements: its "Drop over a child" scenario still holds with
the shared tracker, which also fixes it in WebKit.

## Non-goals

- Uploading. There is no request, progress, retry or per-file status. The consumer uploads
  in `onFilesChange` and may render a Progress inside an Item.
- `transformFiles` (image compression and similar): the consumer does it before applying
  the value.
- `showOpenFilePicker` / the File System Access API.
- A drag-time accept/reject verdict. Nothing about the files is readable before the drop,
  and Safari exposes no types.
- A `RejectionGroup` part. Rejections are in the render state.
- React Aria-style keyboard "virtual drop" of in-page items.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/file-upload/`, `packages/react/src/file-upload/`,
  `getFileUpload` in `@rind-ui/testing`, `packages/theme/src/file-upload.css` (family
  `field`), site example and skin, `docs/components/file-upload.md`.
- Changed: `packages/core/src/dom/file-intake.ts`,
  `packages/core/src/components/shared/file-validation.ts`, the env interface
  (`core/src/contract/env.ts`) and both adapters, and Prompt Input's drop handling (moved to
  the shared tracker, behaviour unchanged).
- No new dependency.
