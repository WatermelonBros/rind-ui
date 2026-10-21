## Why

All 70 compound components export their parts as an object literal
(`export const ColorPicker = { Root, Area, ChannelInput, FormatSelect, … }`). A bundler cannot
remove unused properties from an object, so using one part bundles every part and everything
those parts import. `ColorPicker` is 94 kB gzip because its object holds Number Input, Slider,
Radio Group, Select-based format parts and the eye dropper, whether the consumer renders them
or not; `DateField` (87 kB) holds the whole Calendar and Popover for the same reason.

## What Changes

- Each compound component's parts live in a module and the namespace is an ES module
  namespace re-export (`export * as ColorPicker from "./color-picker.parts"`). Rolldown
  (Vite's production bundler) and Rollup tree-shake static member access on a re-exported
  module namespace, so `ColorPicker.Root` alone bundles only Root and its imports. esbuild
  does not (checked: it shakes only a namespace the consumer itself creates with
  `import * as`); esbuild users keep today's sizes.
- Aliased members (`AreaBackground: ColorArea.Background`) become named re-exports
  (`export { Background as AreaBackground } from "../color-area/…"`).
- Consumer code is unchanged: `import { ColorPicker } from "@rind-ui/react"` and
  `<ColorPicker.Root>` work as before, with the same types.
- A part a Root renders internally stays bundled with the Root; only parts the consumer can
  leave out become optional.
- The size check measures a minimal composition per compound component (its root plus required
  parts) and a full one, and budgets both.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `react-adapter`: compound components expose parts through a module namespace; unused parts
  are not bundled.
- `bundle-size`: minimal-composition budgets per compound component.

## Non-goals

- Changing any part's behaviour, name or props.
- Splitting a Root's internal dependencies (a Root that always needs Field keeps it).
- Per-part subpath exports (`@rind-ui/react/color-picker/area`): the namespace already gives
  the same result with no new import style.

## Impact

- `packages/react/src/*/` for the 70 compound components (parts module + namespace re-export).
- `scripts/docs-gen.ts` reads parts from a module namespace type (verify output unchanged).
- `scripts/size.mjs` and `scripts/size-budgets.json` (minimal-composition entries).
- Generated docs and `llms.txt` must not change.
