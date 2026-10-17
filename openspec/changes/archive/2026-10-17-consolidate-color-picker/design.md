## Context

Every part of the Color Picker was already the standalone component bound to the picker's colour (`ColorPicker.Area` renders
`ColorArea.Root` with the picker's value). The consolidation is therefore an API and docs change, not a rewrite.

## Decisions

### 1. The part components stay, internal

The part modules (`packages/react/src/color-area`, …) keep their code; only the package barrel stops exporting them. The
picker's parts keep wrapping them, so their machines, connect functions and contracts in core are unchanged. Core keeps
exporting them: core is framework-neutral, and another adapter's Color Picker needs the same machines.

### 2. Their behaviour tests stay

The part tests render the part components directly through `packages/testing/src/components/color-parts.ts`, a test-only
module that imports them from `@rind-ui/react/color-internals`: an entry with only the workspace's `@rind-ui/source`
condition (no `types`, no `default`), so published builds expose nothing. A relative import of another package's source
was tried first and rejected: the testing package's declaration build then writes `.d.ts` files into React's `src`. Rewriting every behaviour test through a picker would test the
same code with more wiring; the picker's own tests cover the binding.

### 3. One capability in effect, the part specs kept

The parts' behaviour requirements stay in their specs (they describe what the parts do); each Anatomy requirement now says
the component is a Color Picker part and is not exported. Folding ~900 lines into one spec would change no behaviour.

### 4. One selected mark

The swatch group's indicator inherited Radio Group's dot, and the site examples put a "✓" inside it: two marks. The
indicator now carries the `data-color-swatch-picker` hook and its own rules: absolutely positioned with `inset: 0` and auto
margins (an absolutely positioned grid child gets no grid alignment), a ringed dot when empty (`:empty`), the content
centred and no dot otherwise.

## Risks / Trade-offs

- [A workspace-only package entry] → source condition only, no types or runtime export; one module, test support only.
