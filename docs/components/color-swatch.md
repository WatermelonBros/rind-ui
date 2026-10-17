# Color Swatch

A chip that shows a colour and tells assistive technology which colour it is. It is used on its own, as the Color Picker's value swatch, and inside the Color Swatch Picker.

```tsx
import { ColorSwatch } from "@rind-ui/react"

<ColorSwatch.Root color="#FF3D8B" />
```

Color Swatch is stateless: it has no machine.

## API

<!-- api:color-swatch -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorSwatch.Root` | `root` | `<div>` | The chip: `role="img"`, named by the colour, never focusable. |
| `ColorSwatch.TransparencyGrid` | `transparency-grid` | `<div>` | A decorative checkerboard under a colour with transparency. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `color` | `string \| Color` | `transparent` | The colour shown; a string is parsed with `parseColor`. |
| `respectAlpha` | `boolean` | `true` | `false` shows the opaque colour. |
| `colorName` | `string \| (color) => string` | — | A fixed name (a design token) or a function replacing the computed name. |
| `locale` | `string` | — | Formats the transparency percentage. |
| `messages` | `Partial<ColorSwatchMessages>` | — | The role description and the colour words. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "color-swatch" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-transparent` | Present when alpha is below 1 (the theme draws a checkerboard). |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

No actions.

Queries: `color`, `colorName`, `isTransparent`. Traits: none.
<!-- /api -->

## Naming

The swatch is `role="img"` with the role description "color swatch", named by the colour: "vibrant red", "very dark grayish blue", "transparent". The name is computed from the colour itself (see the [Colour model](../guides/color-model.md)), so it is translated with the colour words of `messages`, never with a lookup table of named colours.

- `colorName="Brand red"` replaces the computed name (a design token); a `colorName` function replaces the whole computation.
- `aria-label` is added after the colour name: `colorName="Brand red" aria-label="Primary"` is named "Brand red, Primary".
- Children (a check mark) render inside; the name does not change.

## Transparency

A colour with alpha below 1 carries `data-transparent`; the theme draws a checkerboard behind it. `respectAlpha={false}` shows the opaque colour. The colour is set inline (`background-color`, `--rind-color`, `--rind-color-opaque`) with `forced-color-adjust: none`, so it keeps its colour in forced-colours mode, where the theme adds a `CanvasText` border.

A colour given as `var(--x)` is not supported: the model needs the numbers. An unparsable `color` logs a development error and renders transparent.

## Testing

Contract queries: `color(format?)`, `colorName()`, `isTransparent()`. No actions.

```tsx
import { getColorSwatch } from "@rind-ui/testing"

render(<ColorSwatch.Root color="#FF0000" />)
expect(await getColorSwatch(screen, { name: "vibrant red" }).color("hex")).toBe("#FF0000")
```

## Tested with

<!-- tested-with:color-swatch -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
