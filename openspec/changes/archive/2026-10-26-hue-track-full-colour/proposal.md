## Why

A hue slider paints its track at the colour's own saturation and brightness. On a dark or
grey colour (a surface such as `#242325`) the whole track is near-black or grey, so the slider
no longer shows which hue is where: the user picks hue blind. Reported by the user on the
site's skin builder (the surface colour's picker).

## What Changes

- `channelGradient(color, "hue")` paints its seven stops at full saturation and full
  brightness (lightness 50 in an `hsl` space), independent of the colour's other channels.
- Every other channel's track is unchanged: saturation, brightness, lightness, the RGB
  channels and alpha still show the colour's context.
- A hue slider's track no longer changes when the area changes saturation or brightness.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `color-model`: the hue gradient is the full-colour strip.
- `color-slider`: the track scenario for hue follows.

## Non-goals

- The thumb colour (`--rind-color`) keeps showing the colour at the thumb, not the full hue.
