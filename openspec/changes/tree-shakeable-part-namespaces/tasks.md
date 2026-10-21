## 1. Pilot

- [ ] 1.1 Color Picker: `color-picker.parts.ts`, named part exports, `export * as ColorPicker` in `index.ts`
- [ ] 1.2 Date Field the same
- [ ] 1.3 Check webpack 5 and Turbopack namespace shaking with the fixture; record in design.md
- [ ] 1.4 Measure minimal compositions vs today; record numbers in design.md; fix Root imports that defeat shaking

## 2. Migration

- [ ] 2.1 Migrate the remaining compound components (batches; `pnpm typecheck` per batch)
- [ ] 2.2 `scripts/docs-gen.ts` output unchanged (generated docs, `llms.txt` diff empty)
- [ ] 2.3 `scripts/lint-use-client.mjs` requires `"use client"` in parts modules

## 3. Size check

- [ ] 3.1 `size-budgets.json`: `minimal` compositions for every compound component; `size.mjs` measures them with Rolldown and enforces them, fails on a missing entry
- [ ] 3.2 Lower full-namespace budgets where they dropped

## 4. Verify and ship

- [ ] 4.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check, site build and audit pass
- [ ] 4.2 Installation docs: which bundlers shake parts
- [ ] 4.3 Changeset (patch, `@rind-ui/react`: smaller bundles, same API)
