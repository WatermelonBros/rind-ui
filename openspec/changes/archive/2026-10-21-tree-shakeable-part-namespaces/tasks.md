## 1. Pilot

- [x] 1.1 Color Picker: `color-picker.parts.ts`, named part exports, `export * as ColorPicker` in `index.ts`
- [x] 1.2 Namespace re-export plugin for tsdown (Rolldown materialised the namespace as an object)
- [x] 1.3 Check webpack 5 and Turbopack namespace shaking with the fixture; record in design.md (webpack yes, Turbopack not checked)
- [x] 1.4 Measure the pilot; record numbers in design.md

## 2. Migration

- [x] 2.1 Migrate the remaining compound components (65 namespaces; Heading, Label and colour internals left, see design)
- [x] 2.2 `scripts/docs-gen.ts` output unchanged (`pnpm docs:check` passes)
- [x] 2.3 Parts modules are barrels: no `"use client"` (lint-use-client passes)

## 3. Size check

- [x] 3.1 `size-budgets.json` `roots`: every part namespace's root alone, measured with Rolldown; `size.mjs` fails on a missing entry or over budget
- [x] 3.2 Full-namespace budgets unchanged (esbuild does not shake namespaces)

## 4. Verify and ship

- [x] 4.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check, site build and audit pass
- [x] 4.2 Installation docs: which bundlers shake parts
- [x] 4.3 Changeset (patch, `@rind-ui/react`: smaller bundles, same API)
