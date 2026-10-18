## Why

The Color Picker is one component, but its parts still carried the scopes of the components they are built on
(`color-area`, `slider`, `number-input`, `color-field`, `radio-group`, `color-swatch`). A theme had to style it through six
scopes, a Slider or Radio Group stylesheet leaked into the picker's parts, and the swatch group needed a
`data-color-swatch-picker` marker to be told apart from a Radio Group.

## What Changes

- **BREAKING for themes (unreleased; minor on 0.x)**: every Color Picker part carries `data-scope="color-picker"` with its own
  part name (`area-thumb`, `channel-slider-track`, `channel-input`, `swatch-trigger`, …); `data-color-swatch-picker` is gone.
- Slider, Number Input and Radio Group connect gain an additive, optional hosted naming (the host's scope and part names);
  their defaults are unchanged. Contracts gain an optional `partName`, and the test adapters locate parts through it.
- The theme merges `color-checker`, `color-swatch`, `color-area`, `color-slider`, `color-field` and `color-swatch-picker` into
  `color-picker.css`, which styles the channel slider and the inputs itself; the docs site skin follows.

## Capabilities

### Modified Capabilities

- `color-picker`, `color-area`, `color-swatch-picker`: data attributes under the picker's scope.
- `slider`, `number-input`, `radio-group`: hosted naming (added, defaults unchanged).

## Impact

core connect (slider, number-input, radio-group, colour parts), contract types, testing adapters, driver and model runner,
React parts, theme `color-picker.css` (six sheets removed), `index.css`, `families.ts`, the site skin, meta and docs.
