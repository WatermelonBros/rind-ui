---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Prompt Input, the first AI-UI primitive: a native form with a content-sized textarea, IME-safe Enter (Shift+Enter, Mod+Enter, `submitKey`, newline on phones), the send/stop lifecycle driven by `onSubmit` (a promise) and `status` with no model inside, one Submit button that becomes Stop and keeps focus, a failed send that restores the prompt, attachments from the file chooser, paste and drop with `accept` / `maxFiles` / `maxFileSize` and every refusal reported, history recall, a character or token limit, and announcements for stop, failure and files; `usePromptInput`, `getPromptInput`, `prompt-input.css`. Contract parts gain `setFiles(files)`; the theme gains the `arrow-up`, `stop` and `paperclip` icons; `core/dom` gains the file-intake helpers (`matchesAccept`, `validateFiles`, `filesFromClipboard`, `syncFileInput`, …).
