## Why

Every component bundle carries the whole quirks registry: bug links, repro test paths,
removal conditions and verification dates for every entry, because `quirkActive` looks an
entry up in the same array that holds that metadata. It is 7.4 kB minified (2.5 kB gzip) of
CI and docs data in every component, about 15% of `Button`'s 17 kB gzip.

## What Changes

- The registry is split in two modules: the runtime conditions (id → predicate over the
  platform) and the metadata (links, test, removeWhen, verified, invariants) keyed by the
  same ids. A missing or extra id on either side is a compile error.
- `quirkActive` reads only the conditions, so a component bundle no longer contains the
  metadata.
- The public `quirks` array keeps its shape (`when` included); it is built from both
  modules and stays tree-shakeable, so only code that imports it pays for it.
- `scripts/quirks-check.ts` and `scripts/docs-gen.ts` read the metadata module.
- New capability `bundle-size`: the per-component budgets introduced in #190 become a
  spec, plus a check that no component bundle contains quirk metadata.

## Capabilities

### New Capabilities

- `bundle-size`: what a consumer downloads per component — budgets, the Button-to-library
  ratio, and tooling-only data kept out of runtime bundles.

### Modified Capabilities

- `a11y-quirks`: the registry requirement states that runtime checks load the conditions
  only, never the entry metadata.

## Non-goals

- Changing which quirks exist or when they apply.
- Splitting the conditions per quirk (all predicates together are a few hundred bytes).
- The other size work (environment capabilities, dev-only code, press/service, composite
  components): separate changes.

## Impact

- `packages/core/src/dom/quirks.ts` (split), a new conditions module, `scripts/quirks-check.ts`,
  `scripts/docs-gen.ts`, `scripts/size.mjs` (metadata check), `scripts/size-budgets.json`
  (budgets lowered to the new measurements).
- Public API unchanged: `quirks`, `quirkActive`, `QuirkId`, `QuirksAffecting`, `defineQuirks`.
