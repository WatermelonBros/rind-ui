# Colour model

Every colour component shares one model, in `@rind-ui/core`: a colour is plain data — `{ space, channels, alpha }` in `rgb`, `hsl` or `hsb` — and every operation is a function, so a colour survives `structuredClone`, JSON and a server render.

```ts
import { formatColor, getChannel, parseColor, withChannel } from "@rind-ui/core"

const blue = parseColor("#3366ff")
formatColor(withChannel(blue, "saturation", 50), "hex")
getChannel(blue, "hue") // a channel the space lacks is reached by converting
```

## Parsing and formatting

`parseColor` reads hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, any case), `rgb()`/`hsl()` in the comma and the space-and-slash forms, `hsb()` and `transparent`; out-of-range channels clamp, hue wraps except exactly 360. Anything else throws `ColorParseError`; `tryParseColor` returns `null`. `formatColor(color, "hex" | "rgb" | "hsl" | "hsb" | "css")` is locale-independent and never uses exponent notation. Every component prop accepts a string or a colour.

## Channels

| Channel | Range | Step | Page step |
|---|---|---|---|
| red, green, blue | 0–255 | 1 | 17 |
| hue | 0–360 | 1 | 15 |
| saturation, lightness, brightness | 0–100 | 1 | 10 |
| alpha | 0–1 | 0.01 | 0.1 |

`withChannel` clamps, rounds to the channel's precision and, for a channel the space lacks, converts first; it returns the same object when nothing changes. Steps snap to the step grid, so repeated steps never drift.

## Hue memory and the echo rule

A grey, white or black colour has no hue of its own. Components remember the last hue and saturation (`colorMemory`) and keep their **working colour** in the space they edit. When a controlled parent passes back the colour a component emitted — even as a new `rgb` object parsed from a string every render — and it is the same sRGB colour, the working colour (with its hue) is kept: a hue slider dragged to 360, or to any hue at black, stays where it is. A colour in the working space is always adopted, so a parent can set a hue at black by passing an `hsb` colour. A change that does not alter the emitted colour (a hue moved at black) calls no callback.

Components emit in the space of the colour you passed (the Color Picker emits in the space of its `format`), so you get back the kind of colour you gave.

## Colour names

`colorName(color, messages)` describes a colour from its OKLCH lightness, chroma and hue: "vibrant red", "very dark grayish blue", "white", "50% transparent". The description is locale-free; only the words come from `messages` (`colorMessages`), so translating the words translates every name. A `colorName` prop replaces the computation on any colour component.

## Equality

`isEqualColor` compares the space and the channels (change detection); `isSameColor` compares the 8-bit sRGB values and the alpha byte, whatever the spaces (swatch matching, the echo rule).

## Gradients

`channelGradient(color, channel, { direction })` and `areaGradient(color, x, y, { rtl })` return CSS gradient strings whose stops are the model's colours, for every channel and pair of channels.
