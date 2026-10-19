## 0. Research and spec

- [x] 0.1 Research note `docs/research/file-upload.md` (Zag / Ark, React Aria, Kobalte, react-dropzone; bug history; a11y)
- [x] 0.2 This change: proposal, design, `specs/file-upload/spec.md`; `openspec validate add-file-upload --strict`

## 1. Shared infrastructure

- [x] 1.1 `components/shared/file-validation.ts`: reasons `MIN_SIZE`, `DUPLICATE`, `DIRECTORY`, `CUSTOM` + `code`, generic `FileRejection<F>`, array `accept`, extension → MIME fallback, accept parsed once (design §4); Prompt Input tests still pass
- [x] 1.2 `core/dom/file-intake.ts`: `dragPresence` (entered-element set, pruning, document `drop`/`dragend`), `dragHasFiles` with item kinds, `filesFromDrop` with directory traversal and `refused`, `filePath`, cancel-safe sync (design §3); Prompt Input keeps its root-level drag tracking (moving it is in the review backlog); browser test with `relatedTarget: null`
- [x] 1.3 Env `dropFiles` and `pasteFiles` in `core/src/contract/env.ts`, DOM and Playwright adapters

## 2. Machine

- [x] 2.1 `file-upload.machine.ts`: states `idle` / `dragging`, events per design §2, validation order and count rules, one write path with controlled `pending`, reset to the current default, effects injected
- [x] 2.2 Node tests: every rejection reason, surplus-only `MAX_FILES`, single-file replace and keep, duplicates within a gesture, controlled refusal and arrival, disabled / read-only, reset, `FILE.REMOVE` twice

## 3. Connect

- [x] 3.1 `file-upload.connect.ts`: parts and attributes per design §5, Trigger labelling and description chain, summary, `formatFileSize`
- [x] 3.2 `file-upload.messages.ts` (shared rejection keys with Prompt Input, new keys), `file-upload.meta.ts`
- [x] 3.3 Connect and meta tests

## 4. React parts

- [x] 4.1 `FileUpload.Root`, `Label`, `Dropzone`, `Trigger`, `ItemGroup`, `Item`, `ItemName`, `ItemSize`, `ItemPreview`, `ItemRemove`, `ClearTrigger`; Field and Fieldset binding; `hidden-form-input`; paste; document-drop prevention; `domDropSource` and `dropSource` prop; focus after removal; dev warnings (design §6, §7)

## 5. Contract and driver

- [x] 5.1 `file-upload.contract.ts`: anatomy, locate, actions, queries, traits, invariants, event mapping
- [x] 5.2 `getFileUpload` exported from `@rind-ui/testing`

## 6. Tests

- [x] 6.1 DOM tests (jsdom and browser): anatomy, chooser (Playwright `filechooser`), pick-remove-pick, cancel, drop over children, double open, document drop, paste, validation, directories (fake entries), custom drop source, form submit / reset / required / fieldset / Field, announcements, focus after removal, controlled, SSR + hydration
- [x] 6.2 Model-based tests over the configurations of design §9 in Chromium, Firefox and WebKit; jsdom subset

## 7. Theme

- [x] 7.1 `packages/theme/src/file-upload.css` per design §10, imported from `index.css`, `file-upload` in the `field` family
- [x] 7.2 Browser test: dashed → solid while dragging, button sizes ≥ 24 px, forced colors, RTL

## 8. Site and docs

- [x] 8.1 Site example `apps/site/examples/file-upload.tsx` (single, multiple with limits, images with previews, directory, in a form with Field, disabled, read-only, controlled) and skin `apps/site/skins/file-upload.css`, registered
- [x] 8.2 Docs page `docs/components/file-upload.md` with "When to use" and the Tauri drop source recipe; `docs/components.md` status
- [x] 8.3 Changeset

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, changed tests (node, jsdom, browser in three engines), site audit 0 findings
