## Context

`quirks.ts` holds one array of entries (`id`, `when`, `links`, `test`, `removeWhen`,
`verified`, `invariants`). `quirkActive(id, env)` does `quirks.find(...)`, so any module
that checks a quirk (press, modality, link, hover, keyboard, scroll-lock, collection…)
pulls the whole array, metadata included, into every component bundle. Measured with
esbuild on `@rind-ui/react/button`: `dom/quirks.mjs` is 7 393 bytes of 48 523 minified.

## Goals / Non-Goals

**Goals:** runtime checks carry predicates only; the compiler keeps conditions and
metadata in step; public API and scripts unchanged in behaviour.

**Non-Goals:** per-quirk modules; changing any entry.

## Decisions

1. **Two modules keyed by id.**
   - `dom/quirk-conditions.ts`: `export const quirkConditions = { "<id>": (p) => …, … }`
     with `satisfies Record<string, (p: PlatformFlags) => boolean>`. `QuirkId` is
     `keyof typeof quirkConditions`.
   - `dom/quirk-meta.ts`: `export const quirkMeta = { "<id>": { links, test, removeWhen,
     verified, invariants? } } satisfies Record<QuirkId, QuirkMeta>`, type-only imports.
     `Record<QuirkId, …>` makes a missing id an error; an object literal with an unknown
     key is an excess-property error. Both directions are compile errors.
   - `dom/quirks.ts`: the public list, built from both (decision 3).
   - Why not keep one array and strip fields at build time: a transform is more machinery
     than a second object, and breaks when the shape changes.
   - Why an object, not an array: the keys give the both-ways check for free.
2. **`quirkActive` lives with the conditions** and reads `quirkConditions[id](env.platform)`.
   Modules that check quirks import it from `quirk-conditions`. `dom/index.ts` still
   re-exports it from the same public name.
3. **`quirks` export keeps its shape.** `quirks.ts` builds it with a
   `/* @__NO_SIDE_EFFECTS__ */` function (as `defineQuirks` already is) that zips
   `quirkMeta` with `quirkConditions`; a `@__PURE__` comment on a chained
   `Object.entries(…).map(…)` would mark only the outer call. Typed as the previous entry union so `QuirksAffecting` still infers from `invariants`.
   Unused, it tree-shakes away.
4. **Scripts read `quirk-meta.ts`.** Node type stripping loads a `.ts` file directly but does
   not resolve core's extensionless relative imports, so the module the scripts load must
   have no runtime imports. `quirk-meta.ts` has none (as `quirks.ts` today); the scripts
   import `quirkMeta`. It is tooling-only, reached by path from `scripts/`, not exported
   from the package.
5. **Leak check in `size.mjs`.** The script imports `quirk-meta.ts` and fails a component
   whose bundle contains any entry's repro test path or removal condition. Markers come from
   the registry itself, so a new entry is covered with no list to maintain.

## Risks / Trade-offs

- [Two places to touch when adding a quirk] → the compiler fails until both exist; the
  docs comment at the top of each module says so.
- [Leak check false positive: a component contains a string equal to a repro path or removal
  condition] → the strings are long sentences and repo paths; the check names the component.

## Migration Plan

Internal; no consumer change. Lower `size-budgets.json` to the new measurements + ~10%.
