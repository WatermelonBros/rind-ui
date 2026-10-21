## 1. Registry split

- [x] 1.1 Create `packages/core/src/dom/quirk-conditions.ts` with every entry's condition keyed by id, `QuirkId` and `quirkActive`
- [x] 1.2 Create `packages/core/src/dom/quirk-meta.ts` (metadata keyed by id, `satisfies Record<QuirkId, QuirkMeta>`, type-only imports); `quirks.ts` builds the exported `quirks` list from both, pure-annotated
- [x] 1.3 Point every runtime importer of `quirkActive` at `quirk-conditions`; keep `dom/index.ts` exports and `QuirksAffecting` unchanged
- [x] 1.4 Type tests in `quirks.test-d.ts`: condition without metadata and metadata without condition fail to compile

## 2. Tooling

- [x] 2.1 `scripts/quirks-check.ts` and `scripts/docs-gen.ts` read `quirk-meta.ts` (verify `pnpm quirks:check` and the docs generation output is unchanged)
- [x] 2.2 `scripts/size.mjs`: fail when a component bundle contains a quirk repro path or removal condition, naming the components
- [x] 2.3 Re-measure and lower `scripts/size-budgets.json` (measured + ~10%)

## 3. Verify and ship

- [x] 3.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm --filter @rind-ui/react size` pass; Button no longer contains `dom/quirks` metadata
- [x] 3.2 Changeset (patch, `@rind-ui/core`)
