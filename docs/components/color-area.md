# Color Area

A two-dimensional picker for two channels of a colour (saturation and brightness at a fixed hue, by default) over a gradient. It is built from two native range inputs: one per axis, one tab stop between them.

```tsx
import { ColorArea } from "@rind-ui/react"

<ColorArea.Root aria-label="Fill" defaultValue="#3D8BFF">
  <ColorArea.Background />
  <ColorArea.Thumb />
</ColorArea.Root>
```

## API

<!-- api:color-area -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorArea.Root` | `root` | `<div>` | `role="group"`, the pointer surface. Not focusable. |
| `ColorArea.Background` | `background` | `<div>` | The decorative gradient (`aria-hidden`). |
| `ColorArea.Thumb` | `thumb` | `<div>` | The handle, positioned from the value; renders the two native range inputs (x, then y). |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| Color` | — | The colour (controlled). |
| `defaultValue` | `string \| Color` | `"hsb(0, 0%, 100%)"` | The initial colour (uncontrolled); a form reset restores it. |
| `onValueChange` | `(color: Color, details) => void` | — | Each applied change, in the space of the colour you passed; not for a change that leaves the emitted colour as it is (hue at black). |
| `onValueCommit` | `(color: Color, details) => void` | — | Once at the end of each interaction that changed the colour. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | — | The space of the axes (default: the colour's space, else `hsb`). |
| `xChannel` | `ColorChannel` | — | Default: saturation (hsb, hsl), red (rgb). |
| `yChannel` | `ColorChannel` | — | Default: brightness (hsb), lightness (hsl), green (rgb). |
| `xName` | `string` | — | Submits the x channel under this name. |
| `yName` | `string` | — | Submits the y channel under this name. |
| `form` | `string` | — | The id of the form the inputs belong to. |
| `disabled` | `boolean` | `false` | Ignores presses and keys. |
| `readOnly` | `boolean` | `false` | Focusable, changes nothing. |
| `colorName` | `string \| (color) => string` | — | Replaces the colour name in the value text. |
| `locale` | `string` | — | Formats the value text. |
| `dir` | `"ltr" \| "rtl"` | — | Mirrors the x axis. |
| `messages` | `Partial<ColorAreaMessages>` | — | Names, role description, value text, colour words. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "color-area" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | Present when disabled. |
| `root` | `data-readonly` | Present when read-only. |
| `root` | `data-dragging` | Present while dragging. |
| `root` | `data-focus` | Present while either input has focus. |
| `root` | `data-focus-visible` | Present while either input has keyboard focus. |
| `thumb` | `data-scope` | "color-area" |
| `thumb` | `data-part` | "thumb" |
| `thumb` | `data-instance` | The instance id. |
| `thumb` | `data-disabled` | Present when disabled. |
| `thumb` | `data-readonly` | Present when read-only. |
| `thumb` | `data-dragging` | Present while dragging. |
| `thumb` | `data-focus` | Present while either input has focus. |
| `thumb` | `data-focus-visible` | Present while either input has keyboard focus. |

### Keyboard

| Key | Action |
|---|---|
| ArrowLeft / ArrowRight | The x channel by one step (mirrored in right-to-left). |
| ArrowUp / ArrowDown | The y channel by one step; focus moves to the y input. |
| Shift + arrow | By the channel's page step. |
| PageUp / PageDown | The y channel by its page step. |
| Home / End | The x channel to its minimum / maximum. |
| Escape | While dragging: cancels the drag and restores the colour. |

### States

| State | Description |
|---|---|
| `idle` | No pointer drag. |
| `dragging` | A pointer drag is active. |

### Contract

| Action | Modalities |
|---|---|
| `focusAxis` | keyboard |
| `step` | keyboard |
| `toEdge` | keyboard |
| `setChannels` | keyboard, pointer |
| `pressAt` | pointer, touch, keyboard |
| `pointerDown` | pointer, touch |
| `pointerMove` | pointer, touch |
| `pointerUp` | pointer, touch |
| `cancelDrag` | keyboard, pointer, touch |
| `adjustNative` | keyboard |
| `resetForm` | pointer, keyboard |

Queries: `channels`, `color`, `valueText`, `colorName`, `focusedAxis`, `isDragging`, `formValues`. Traits: `directional`, `form-associated`.
<!-- /api -->

## Anatomy

`Root` is the pointer surface (`role="group"`), `Background` the decorative gradient, `Thumb` the handle. The Thumb renders the **x input** and the **y input**, the only two `slider`s: both are exposed to assistive technology, named "Fill Saturation" and "Fill Brightness", with the role description "2D slider". The thumb's position, both input values and the gradient are in the server HTML.

## Axes

The axes follow the colour space: `hsb` gives saturation × brightness, `hsl` saturation × lightness, `rgb` red × green. `colorSpace` sets the space (default: the space of the first colour given, else `hsb`); `xChannel` and `yChannel` pick other channels of that space, such as hue × saturation. The third channel is held constant and shown by the Background. Alpha is never an axis and every edit keeps it.

## Keyboard

| Key | Does |
|---|---|
| ArrowLeft / ArrowRight | The x channel by one step (mirrored in right-to-left) |
| ArrowUp / ArrowDown | The y channel by one step |
| Shift + arrow | The channel's page step |
| PageUp / PageDown | The y channel by its page step |
| Home / End | The x channel to its minimum / maximum |
| Escape | While dragging only: cancels the drag and restores the colour |

When a key changes the other axis's channel, focus moves to that axis's input, so a screen reader reads the changed value. A step on the focused axis never blurs anything. Escape outside a drag is left to the dialog or popover around the Area.

## Pointer

A press jumps both channels to the pressed point in one write and focuses the x input without a focus ring; a press on the Thumb keeps the value and the offset from its centre for the whole drag. Pointer values snap to a finer resolution than the keyboard step (0.1 for hue, saturation, lightness and brightness), so a large Area does not jitter. The drag captures the pointer and ends on release anywhere, including outside the window.

## Value text

When an input receives focus, its value text lists the focused channel, the other axis and the held channel, then the colour name ("Saturation 80%, Brightness 60%, Hue 220°, vibrant blue"); after a change it reads only the changed channel and the name. It is never a live region.

## Value and commit

`value`, `defaultValue` and `onValueChange` follow the [Colour model](../guides/color-model.md)'s controlled-value rule: you get back colours in the space you passed, the hue survives grey and black, and a change that does not alter the emitted colour (a hue moved at black) calls nothing. `onValueCommit` runs once per keyboard step, adjustment or pointer release that changed the colour; never for a cancelled drag, a form reset or a controlled change.

## Form participation

`xName` and `yName` submit the two channel values. A form reset restores the current `defaultValue` without a callback.

## Testing

Contract actions: `focusAxis`, `step`, `toEdge`, `setChannels`, `pressAt`, `pointerDown`, `pointerMove`, `pointerUp`, `cancelDrag`, `adjustNative`, `resetForm`. Queries: `channels`, `color`, `valueText`, `colorName`, `focusedAxis`, `isDragging`, `formValues`.

```tsx
import { getColorArea } from "@rind-ui/testing"

const area = getColorArea(screen, { name: "Fill" })
await area.step("x", "increase")
expect((await area.channels()).x.value).toBe(51)
await area.adjustNative("y", 40) // what TalkBack and iOS VoiceOver do
```

Keyboard actions work in jsdom; `pressAt` and the drag actions need a layout engine and say so without one.

## Tested with

<!-- tested-with:color-area -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
