## 1. Naming

- [x] 1.1 `PartNaming` (core connect): Slider and Number Input connect take an optional `naming`; Radio Group's `RadioNaming` gains an optional `part` mapping; React reads them from internal contexts. One hosted-naming test per component; their existing tests unchanged and green
- [x] 1.2 `color-picker.naming.ts`: the part names; the area and colour field connect, the channel slider, channel input, swatch group and swatches render under `color-picker`; `data-color-swatch-picker` removed
- [x] 1.3 `Field.Root` and `FieldHost` take the root's part name (`rootPart`, default `root`) for a Field host that is another component's part (`channel-input-root`)

## 2. Contracts and drivers

- [x] 2.1 Contracts take an optional `partName`; the DOM and Playwright adapters locate parts through it (anatomy names only) and name collected parts back to anatomy names; a contract's own `scope` now wins over one spread in from another contract; the colour contracts and `getColorPicker().swatch()` use the picker's scope
- [x] 2.2 `sliderStepInvariants` takes an optional naming

## 3. Theme, skin, docs

- [x] 3.1 One `color-picker.css` (the six part sheets merged, the channel slider and inputs styled without slider.css / number-input.css), `index.css`, `families.ts`
- [x] 3.2 Site skin `color.css` rewritten to the new selectors
- [x] 3.3 Meta (anatomy part names, every-part attributes), generated docs, a Styling section

## 4. Proof

- [x] 4.1 Colour tests, the Slider / Number Input / Radio Group / Color Swatch tests unchanged, the colour Playwright fixture, the examples test (snapshots unchanged), lint, typecheck, docs check, site build and audit; changeset
