# color-model Specification

## Purpose
Defines the colour model every colour component shares: a plain, immutable colour value in `rgb`,
`hsl` or `hsb` with alpha; parsing, formatting, conversion that remembers hue, channel ranges
and steps, equality, localisable colour names, CSS gradients for channels and areas, and the rule
for controlled colour values. Pure TypeScript in `@rind-ui/core`, no DOM and no framework.
Research: `docs/research/color-picker.md`.
## Requirements
### Requirement: Colour Value

A colour SHALL be a plain, frozen, JSON-serialisable object `{ space, channels, alpha }` with
`space` one of `"rgb"`, `"hsl"`, `"hsb"`, three `channels` in the space's order (`red, green,
blue` · `hue, saturation, lightness` · `hue, saturation, brightness`) and `alpha` from 0 to 1.
Every colour API and every colour component prop SHALL accept `string | Color`: a string is parsed
with the rules below. A value that is neither a parsable string nor a colour SHALL throw
`ColorParseError` from the model functions; a component SHALL treat it as an invalid input as its
own requirement says. The model SHALL expose its operations as functions (`parseColor`,
`tryParseColor`, `formatColor`, `toSpace`, `getChannel`, `withChannel`, `channelRange`,
`isEqualColor`, `isSameColor`, `colorName`, `channelGradient`, `areaGradient`), never as methods
of the value, so a colour survives `structuredClone`, `JSON.stringify` and a server render
unchanged.

#### Scenario: A string where an object was expected (ark#2932)

- **WHEN** a component receives `value="#3366ff"` or `value={parseColor("#3366ff")}`
- **THEN** both behave identically and nothing throws `toFormat is not a function`

#### Scenario: Structured clone

- **WHEN** a colour is passed through `structuredClone` and then to `formatColor`
- **THEN** the result equals the result for the original

### Requirement: Parsing

`parseColor` SHALL accept, with surrounding whitespace ignored and any letter case: hex `#rgb`,
`#rgba`, `#rrggbb`, `#rrggbbaa`; `rgb()`/`rgba()` and `hsl()`/`hsla()` in the legacy comma form and
the CSS Color 4 space and slash form, channels as numbers or percentages; `hsb()`/`hsba()` (comma form,
saturation and brightness in percent); and the keyword `transparent`. A hex colour SHALL parse in
`rgb`, `rgb()` in `rgb`, `hsl()` in `hsl`, `hsb()` in `hsb`. Channel values outside their range
SHALL be clamped, except hue, which SHALL be taken modulo 360 with exactly 360 preserved. Anything
else, including a hex of another length, SHALL fail. `tryParseColor` SHALL return `null` instead of
throwing. A `#` SHALL be required by `parseColor`; the fields' lenient parsing is specified by
`color-field`. `#0000` SHALL parse as transparent black, not as a default.

#### Scenario: Hex forms and case (react-spectrum#7547)

- **WHEN** `#E84E0F`, `#e84e0f`, `#E84E0FFF` and `#ABC` are parsed
- **THEN** the first three give `rgb(232, 78, 15)` (alpha 1, 1 and 1 for the first, second and
  third) and the last gives `rgb(170, 187, 204)`

#### Scenario: Hue 360 survives (react-spectrum#6202)

- **WHEN** `hsb(360, 100%, 100%)` is parsed and formatted as `hsb`
- **THEN** the result is `hsb(360, 100%, 100%)`, and `hsb(370, 100%, 100%)` formats as `hsb(10, 100%, 100%)`

#### Scenario: Modern syntax

- **WHEN** `rgb(12 34 56 / 50%)` and `hsl(210deg 60% 40%)` are parsed
- **THEN** the first has alpha 0.5 and the second hue 210

#### Scenario: Invalid input

- **WHEN** `parseColor("#12")`, `parseColor("blue")` and `parseColor("rgb(1,2)")` run
- **THEN** each throws `ColorParseError` and `tryParseColor` returns `null` for each

#### Scenario: Transparent black is not a default (react-spectrum#6363)

- **WHEN** `#0000` and `transparent` are parsed
- **THEN** both are `rgb(0, 0, 0)` with alpha 0

### Requirement: Formatting

`formatColor(color, format)` SHALL return a string in one of the formats `hex`, `rgb`, `hsl`, `hsb`, or
`css`. `hex` SHALL be `#RRGGBB` upper case, or `#RRGGBBAA` when alpha is below 1 (alpha rounded to a
byte); `rgb` and `hsl` SHALL be the legacy comma form (`rgb(r, g, b)`, `rgba(r, g, b, a)`,
`hsl(h, s%, l%)`, `hsla(…)`), `hsb` the non-CSS `hsb(h, s%, b%)` / `hsba(…)`; `css` SHALL be the
string a browser accepts for the colour (`hex` for opaque `rgb`, otherwise `rgb`/`hsl` form). A
non-`rgb` colour SHALL be converted for `hex`, `rgb` and `hsl` formats as needed. Channel text SHALL
be rounded to the channel's precision, never use exponent notation, and never depend on the
locale. Formatting SHALL be a pure function of the colour and the format.

#### Scenario: Alpha in hex

- **WHEN** `rgb(255, 0, 0)` with alpha 0.5 is formatted as `hex`
- **THEN** the result is `#FF000080`

#### Scenario: Locale independence

- **WHEN** a colour with alpha 0.25 is formatted while the document locale is `de-DE`
- **THEN** the result contains `0.25`, not `0,25`

#### Scenario: Round trip

- **WHEN** every colour of a grid of 4096 opaque 8-bit sRGB values (plus every grey and primary) is formatted as
  `hex`, `rgb`, `hsl` and `hsb`, parsed and converted back to `rgb`
- **THEN** each equals the original

### Requirement: Conversion And Hue Memory

`toSpace(color, space, memory?)` SHALL convert between `rgb`, `hsl` and `hsb`, rounding to each
channel's precision, and SHALL return the same object when the space is already `space`.
Converting an achromatic colour to a space with a hue SHALL take `memory.hue` (and, for black and
white, `memory.saturation`) when given, and 0 otherwise; a conversion SHALL never invent or discard
a hue that the source colour carries. `colorMemory(color, previous?)` SHALL return the hue and
saturation to remember after seeing `color`: its own when it has chroma (saturation above 0 and the
third channel above 0), otherwise `previous`.

#### Scenario: Hue survives grey in the area's space (react-spectrum#9509)

- **WHEN** an `hsb(120, 0, 100)` colour is converted to `rgb` and back with `memory = { hue: 120 }`
- **THEN** the result is `hsb(120, 0, 100)`; without memory it is `hsb(0, 0, 100)`

#### Scenario: Identity

- **WHEN** an `hsb` colour is converted to `hsb`
- **THEN** `toSpace` returns the very same object

#### Scenario: HSL and HSB agree

- **WHEN** `hsb(210, 60, 80)` is converted to `hsl` and then to `rgb`, and directly to `rgb`
- **THEN** both `rgb` colours are equal

### Requirement: Channels And Ranges

Channels SHALL be named `red`, `green`, `blue`, `hue`, `saturation`, `lightness`, `brightness` and
`alpha`; a channel exists in a space when it is one of its three channels, and `alpha` exists in
all. `channelRange(space, channel)` SHALL return `{ min, max, step, pageStep, precision }`:
`red`/`green`/`blue` 0–255, step 1, page 17, precision 0; `hue` 0–360, step 1, page 15, precision 2;
`saturation`/`lightness`/`brightness` 0–100, step 1, page 10, precision 2; `alpha` 0–1, step 0.01,
page 0.1, precision 2. `getChannel(color, channel)` SHALL resolve a channel the colour's space lacks by
converting (to `hsb` for `hue`/`saturation`/`brightness`, `hsl` for `lightness`, `rgb` for the
colour channels) and SHALL NOT throw for any named channel. `withChannel(color, channel, value)` SHALL
clamp to the range, round to the precision, and for a channel the space lacks convert first and
return the colour in the **converted** space; it SHALL be a no-op returning the same object when the
rounded value equals the current one. Stepping SHALL use the shared decimal-safe snapping
(`core/shared/step-math.ts`), so repeated steps never accumulate floating-point error.

#### Scenario: A channel the space lacks (zag#2389, ark#1649, react-spectrum#4561)

- **WHEN** `getChannel(rgb(255, 0, 0), "hue")` and `withChannel(rgb(255, 0, 0), "saturation", 50)` run
- **THEN** the first returns 0 and the second returns an `hsb` colour with saturation 50, and neither throws

#### Scenario: Clamp and precision

- **WHEN** `withChannel(c, "hue", 400)` and `withChannel(c, "alpha", 0.3333)` run
- **THEN** hue is 360 and alpha is 0.33

#### Scenario: No drift

- **WHEN** alpha is increased by `step` 100 times from 0
- **THEN** it is exactly 1

#### Scenario: No-op write

- **WHEN** `withChannel(c, "red", 255)` runs on a colour whose red is already 255
- **THEN** the same object is returned

### Requirement: Equality

`isEqualColor(a, b)` SHALL be true when the spaces, the channels (to the channel precision) and the alpha
are equal. `isSameColor(a, b)` SHALL be true when the two colours are the same in sRGB: each of the 8-bit red,
green and blue values equal and `round(alpha * 255)` equal, whatever the spaces. Components SHALL use
`isSameColor` to match a colour against swatches and against a controlled value in a different space
(see "Controlled Colour Value"), and `isEqualColor` for change detection.

#### Scenario: Different spaces, same colour

- **WHEN** `hsb(0, 100, 100)` and `rgb(255, 0, 0)` are compared
- **THEN** `isSameColor` is true and `isEqualColor` is false

#### Scenario: Alpha

- **WHEN** `rgb(0, 0, 0)` with alpha 0.5 and with alpha 0.502 are compared with `isSameColor`
- **THEN** the result is true (both are byte 128)

### Requirement: Colour Names

`colorName(color, messages)` SHALL return a short description a screen reader user can use, built from
a locale-free description (`describeColor(color)`: a hue key, a lightness key, a chroma key and a transparency)
and the strings of `messages`. The description SHALL be computed in OKLCH: lightness above 0.999 is white and
below 0.001 black; chroma below 0.001 is gray; otherwise the hue is the nearest of pink, red, orange, yellow,
green, cyan, blue, purple, magenta (an orange darker than 0.68 lightness is brown; yellow darker than 0.85 is
yellow green; a hue past half-way to the next adds it, "red orange"); chroma 0.15 or more is "vibrant", between
0.001 and 0.1 "grayish" (or "pale" at lightness 0.7 or more); lightness below 0.3 "very dark", below 0.55 "dark",
0.7 to 0.85 "light", above 0.85 "very light". An alpha below 1 SHALL add the transparent percentage ("50%
transparent"); alpha 0 SHALL read as "transparent". `messages` SHALL declare every key the description can
produce (`hues` including the compound keys, `lightness`, `chroma`, templates `colorName` and
`transparentColorName` as typed functions) with English defaults, overridable per component or through the
provider (`i18n-messages`); a key missing from an override SHALL fall back to English; a `colorName` function prop
on any colour component SHALL replace the whole computation. Channel names (`channelName(channel)`) and format
names (`hex`, `rgb`, `hsl`, `hsb`) SHALL come from `messages` too.

#### Scenario: Names

- **WHEN** `#FF0000`, `#000000`, `#FFFFFF`, `#808080` and `#00000000` are named in English
- **THEN** the names are "vibrant red", "black", "white", "gray" and "transparent"

#### Scenario: Translated

- **WHEN** `messages` replaces the hue names and templates with Italian and `#0000FF` is named
- **THEN** the result is Italian and contains no English word

#### Scenario: Custom naming function

- **WHEN** a component gets `colorName={(c) => pantone(c)}`
- **THEN** every value text and swatch name that would contain the colour name uses its result

### Requirement: Gradients

`channelGradient(color, channel, { direction })` SHALL return a CSS `linear-gradient(...)` string for a slider
track of that channel with the other channels fixed: hue as seven stops (0, 60, …, 360 degrees at full
saturation and full brightness, or lightness 50 in an `hsl` space, whatever the colour's own saturation and
brightness: the strip shows every hue on a dark or grey colour too), lightness as three stops, every other channel as its minimum and its
maximum, alpha from the colour at alpha 0 to alpha 1. `direction` SHALL be `to right`, `to left` (RTL) or
`to top` (vertical). `areaGradient(color, xChannel, yChannel, { rtl })` SHALL return the stacked gradients
(`background-image`) of an area for the third channel fixed, with x increasing along the inline axis (towards the
left under `rtl`) and y increasing upward. Both SHALL be pure, SHALL produce stops whose colours equal the model's
colours at the stop positions, SHALL never contain `NaN`, and SHALL work for every channel a colour component
accepts, whatever the colour's own space. The area's corner colours SHALL equal the model's colours at the four
corners within 4 of 255 per sRGB channel.

#### Scenario: RTL hue strip (zag#2666)

- **WHEN** a hue gradient is requested with `direction: "to left"`
- **THEN** the first stop (hue 0) is at the right edge, so the thumb offset and the gradient agree under `dir="rtl"`

#### Scenario: Corner colours

- **WHEN** `areaGradient` is computed for `hsb(200, 50, 50)` with x `saturation`, y `brightness`
- **THEN** the bottom-left corner is black, the top-left white, the top-right `hsb(200, 100, 100)` and the
  bottom-right black

#### Scenario: Any space, any channel

- **WHEN** `channelGradient` is asked for `hue` on an `rgb` colour
- **THEN** it returns a valid hue gradient (the colour is converted internally) and does not throw

#### Scenario: Hue strip on a dark colour

- **WHEN** `channelGradient` is asked for `hue` on `#242325`
- **THEN** its stops are `hsb(0, 100, 100)`, `hsb(60, 100, 100)`, …, `hsb(360, 100, 100)` in sRGB (red, yellow,
  green, cyan, blue, magenta, red), not the near-black of the colour's own brightness

### Requirement: Controlled Colour Value

Every colour component SHALL treat its colour value (`value`, `defaultValue`, `onValueChange`) with these
rules. (1) `value` and `defaultValue` are `string | Color` (or `null` where a component says so); an
unparsable string SHALL be ignored with a development error and the previous colour kept. (2) The component
SHALL keep an **internal colour in its working space** (the space that has the channels it edits: a `colorSpace` prop where
the component has one, else the space of the colour given when it has them, else `hsb`, `hsl` or `rgb` by channel) and SHALL
emit in its **emission space**: the space of the last `value` or `defaultValue` colour it was given (the consumer gets back
the kind of colour it passed), else the working space, except where a component says otherwise (the picker's `format`); it
SHALL call `onValueChange(color, details)` with the colour converted to the emission space. (3) **Echo rule:** a controlled `value` whose space differs from the working space and which
`isSameColor` as the internal colour SHALL be ignored (the internal colour, with its hue and saturation, is kept); a `value` in the
same space SHALL be adopted when `isEqualColor` says it differs, so a consumer can set a hue at black by passing a colour in
the working space. (4) A change that does not alter the colour in the emission space (a hue moved at black)
SHALL update the internal colour and the controls and SHALL call neither `onValueChange` nor `onValueCommit`.
(5) `onValueChange` SHALL be called once per applied change, with `details.reason` (the event), `details.space`
(the working space) and `cancel()`; a controlled proposal the parent refuses SHALL leave the controls on the
controlled value. (6) A programmatic or controlled change SHALL NOT call `onValueChange`.

#### Scenario: A fresh sRGB object every render (zag#2503, Reado)

- **WHEN** a controlled picker is re-rendered with `value={parseColor("rgba(…)")}` for the colour it last emitted, a
  new object each render, while the hue slider is dragged to its right edge (360)
- **THEN** the hue thumb stays at 360 and no extra `onValueChange` runs

#### Scenario: Hue at black (react-spectrum#9509)

- **WHEN** the colour is `#000000` (controlled) and the user drags the hue slider to 120
- **THEN** the thumb moves to 120, the area background shows hue 120, and `onValueChange` is not called (the
  emitted colour is still black); when brightness is then raised the colour becomes green at once

#### Scenario: External set in the working space

- **WHEN** a parent sets `value` to `hsb(200, 0, 0)` while the internal colour is `hsb(10, 0, 0)`
- **THEN** the hue becomes 200 (same space, different channels)

#### Scenario: Refused proposal

- **WHEN** a controlled component proposes a colour and the parent keeps the old `value`
- **THEN** every control still shows the old colour and the next interaction starts from it

#### Scenario: Invalid string

- **WHEN** `value="not a colour"` is passed
- **THEN** a development error is logged naming the prop and the previous colour is kept

