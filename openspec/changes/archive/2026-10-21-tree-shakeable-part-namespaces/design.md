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

## Outcome (implementation)

- **tsdown turns `export * as` into an object.** Rolldown's unbundled output builds the
  namespace with `__exportAll({ … })` and re-exports that object, which defeats shaking (the
  pilot measured no gain until fixed). `scripts/namespace-reexports.ts`, a `renderChunk` plugin in
  `packages/react/tsdown.config.ts`, rewrites `export { x_exports as N } from "…"` and
  `import { x_exports } from "…"` back into `export * as` / `import * as`; the `__exportAll`
  object is then unused and, being `@__PURE__`, dropped.
- **Bundlers checked** with a two-export fixture: Rolldown and webpack 5 (Next's copy; it
  concatenates the modules and leaves the unused part dead for the minifier) drop the unused
  member; esbuild keeps it. Turbopack not checked.
- **Parts modules carry no `"use client"`**: they are barrels (no hooks), so
  `scripts/lint-use-client.mjs` keeps them unmarked; the client boundary stays in the component
  file.
- **Doc row order**: Biome sorts export lists; parts modules whose docs order differs from the
  alphabetical one carry a `biome-ignore assist/source/organizeImports` comment, so the generated
  docs are unchanged.
- **Not migrated**: Heading and Label (`Object.assign` on a component), and the colour internals
  (Color Area, Slider, Swatch, Swatch Picker, Field, Channel Field), which have no subpath entry
  and are read by the docs generator from their component file.
- **Root-only budgets** replace a hand-picked "minimal composition" per component: `<Name>.Root`
  alone, measured with Rolldown, for each of the 65 part namespaces. Examples (gzip): Dialog 23.5
  (whole, esbuild) → 13.9 (root, Rolldown); Date Field 82.5 → 53.8; Popover 34.4 → 23.4;
  Breadcrumbs 13.5 → 3.9; Color Picker with Root, Area and ChannelSlider 85.6 → 68.4.
