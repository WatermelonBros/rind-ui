# Color Swatch Picker

A palette of colour swatches, of which at most one matches the current colour. It **is** a [Radio Group](radio-group.md) whose items are colours: arrows move and check, the group is one tab stop, the checked swatch's key takes part in forms.

```tsx
import { ColorSwatchPicker } from "@rind-ui/react"

<ColorSwatchPicker.Root aria-label="Palette" defaultValue="#3D8BFF">
  <ColorSwatchPicker.Item color="#FF3D8B">
    <ColorSwatchPicker.Swatch />
    <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
  </ColorSwatchPicker.Item>
  <ColorSwatchPicker.Item color="#3D8BFF">
    <ColorSwatchPicker.Swatch />
    <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
  </ColorSwatchPicker.Item>
</ColorSwatchPicker.Root>
```

## API

<!-- api:color-swatch-picker -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorSwatchPicker.Root` | `root` | `<div>` | The Radio Group root (`role="radiogroup"`). |
| `ColorSwatchPicker.Item` | `item` | `<div + button>` | A Radio Group item and its control (`role="radio"`), named by the colour. |
| `ColorSwatchPicker.Swatch` | `root` | `<div>` | The item's colour (a decorative Color Swatch). |
| `ColorSwatchPicker.Indicator` | `item-indicator` | `<span>` | Mounted only while the item is checked (a check mark). |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| Color \| null` | — | The colour (controlled); the matching swatch is checked. |
| `defaultValue` | `string \| Color \| null` | `null` | The initial colour. |
| `onValueChange` | `(color: Color, details) => void` | — | A swatch was checked; `details.value` is its key, `details.index` its index. |
| `name` | `string` | — | Submits the checked item's key (`#RRGGBBAA`). |
| `disabled` | `boolean` | `false` | As Radio Group. |
| `readOnly` | `boolean` | `false` | As Radio Group. |
| `Item.color` | `string \| Color` | — | The swatch's colour. |
| `Item.value` | `string` | — | The item's key (default the canonical `#RRGGBBAA`); tells equal colours apart. |
| `Item.colorName` | `string \| (color) => string` | — | A design-token name instead of the computed one. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-color-swatch-picker` | Present: the theme's hook (parts keep Radio Group's scope). |

### Keyboard

| Key | Action |
|---|---|
| ArrowRight / ArrowDown | The next enabled swatch, checked (wraps; mirrored in RTL). |
| ArrowLeft / ArrowUp | The previous enabled swatch, checked. |
| Space | Checks the focused swatch. |

### States

| State | Description |
|---|---|
| `idle` | No swatch focused. |
| `focused` | A swatch has focus. |

### Contract

No actions.

Queries: `colors`, `selected`, `selectedColor`. Traits: `form-associated`, `field-associated`, `directional`.
<!-- /api -->

## Matching

The checked swatch is derived from the colour: the swatch you chose last while its colour still matches, else the first swatch (in order) whose colour is the same in sRGB, else none. A colour no swatch has **checks nothing** — never the first or a black swatch. Two swatches of the same colour are told apart by their `value` keys (the default key is the canonical `#RRGGBBAA`).

## Names

The group is named by your `aria-label` (default "Color swatches"); each swatch by its colour ("vibrant red"), or by its `colorName` (a design token). The checked swatch shows its Indicator: the selection is not shown by colour alone.

## Keyboard

As Radio Group: arrows move to the next or previous enabled swatch and check it (wrapping, mirrored in right-to-left), Space checks. Up and Down do not move by row.

## Testing

`getColorSwatchPicker` extends `getRadioGroup` with `colors()`, `selected()`, `selectedColor(format?)`, `pick(key | name | index)` and `move(direction)`.

```tsx
import { getColorSwatchPicker } from "@rind-ui/testing"

const palette = getColorSwatchPicker(screen, { name: "Palette" })
await palette.pick("vibrant red")
expect((await palette.selected())?.name).toBe("vibrant red")
```

## Tested with

<!-- tested-with:color-swatch-picker -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
