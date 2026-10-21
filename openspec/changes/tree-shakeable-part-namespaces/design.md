## Context

`packages/react/src/<component>/<component>.tsx` defines the parts as functions and ends with
`export const Name = { Root, Trigger, …, Alias: Other.Part }`. An object literal's properties
are always retained once the object is referenced. A module namespace re-exported with
`export * as NS` is shaken by Rolldown and Rollup: checked with a two-export fixture, Rolldown
keeps only the referenced member. esbuild keeps both members through `export * as` (and through
`import * as NS` + `export { NS }`); it drops the unused one only when the consumer writes
`import * as NS` against the parts module itself. webpack and Turbopack are not checked here.

`scripts/docs-gen.ts` reads parts from the export's type with
`checker.getPropertiesOfType`, which also lists a module namespace's exports.

## Decisions

1. **File layout per component.** Parts stay where they are; the namespace object is replaced
   by a parts module:
   - `<component>.parts.ts`: `"use client"` + `export { Root, Trigger, … } from "./<component>"`
     and aliases as `export { Background as AreaBackground } from "../color-area/color-area"`.
   - `<component>.tsx` exports the part functions by name (they were module-local).
   - `index.ts`: `export * as Name from "./<component>.parts"`.
   Why a separate parts module rather than `export * as Name from "./<component>"`: the
   component file also exports props types and helpers that must not become namespace members.
2. **Public part functions.** Part functions become named exports of the component file, not of
   the package: the package `index.ts` exports only the namespace, so the public API does not grow.
3. **Measure first.** Before migrating all 70, migrate Color Picker and Date Field, measure the
   minimal compositions, and record the numbers in this design. If a minimal composition does
   not shrink, find what the Root imports before going on.
4. **Mechanical migration** of the other components by a Sonnet subagent, one batch at a time,
   with `pnpm typecheck` and the docs-gen diff as the check (generated docs must not change).
5. **Size check with Rolldown.** `size-budgets.json` gains `minimal: { "color-picker":
   ["Root", "Area", "ChannelSlider"], … }`; `size.mjs` bundles `import { Name } from
   "@rind-ui/react/<slug>"; console.log(Name.Root, Name.Area, …)` per entry with Rolldown
   (already a dev dependency, used by `packages/core/scripts/size.mjs`), minified, production.
   The existing full-namespace budgets keep esbuild, so they still describe the worst case.

## Risks / Trade-offs

- [esbuild (and possibly other bundlers) does not shake re-exported namespace members] →
  behaviour unchanged, size as today; the docs' installation page says which bundlers shake
  parts. Before migrating all 70, check webpack 5 and Turbopack with the same fixture and
  record the result here.
- [`"use client"` on re-export modules] → the parts module carries the directive;
  `scripts/lint-use-client.mjs` is extended to require it there.
- [Consumers spreading the namespace (`{...Dialog}`) or iterating it] → still works (a module
  namespace is an object), only loses shaking.
