---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

File Upload: files from the native chooser, a drop or a paste, through one validation (accept with an extension fallback, sizes, duplicates, folders, a custom check; only the surplus over `maxFiles` is refused), held as one list the hidden input mirrors for forms. A real Trigger button, a Dropzone with no role, removal that keeps focus, announcements per gesture, Field and Fieldset binding, form reset, and a `dropSource` for shells such as Tauri. Core: `validateFiles` gains `MIN_SIZE`, `DUPLICATE`, `DIRECTORY`, `CUSTOM`; `file-intake` gains `dragPresence`, folder traversal and `domDropSource`. Testing: `getFileUpload`, and `Part.dropFiles()` / `pasteFiles()` / `dragFiles()` in the contract environment. Theme: `file-upload.css` in the field family.
