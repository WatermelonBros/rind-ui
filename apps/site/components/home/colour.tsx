"use client"

import { formatColor } from "@rind-ui/core"
import { ColorPicker } from "@rind-ui/react"
import type { ColourProps } from "./colour-placeholder"
import styles from "./home.module.css"

/** A labelled colour of the builder: a swatch that opens a picker. */
export function Colour(props: ColourProps) {
  return (
    <ColorPicker.Root
      className={styles.tuneColor}
      value={props.value}
      onValueChange={(c) => props.onChange(formatColor(c, "hex"))}
    >
      <ColorPicker.Label>{props.label}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch />
        </ColorPicker.Trigger>
        <ColorPicker.ValueText />
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.Area>
              <ColorPicker.AreaBackground />
              <ColorPicker.AreaThumb />
            </ColorPicker.Area>
            <ColorPicker.ChannelSlider channel="hue">
              <ColorPicker.ChannelSliderTrack>
                <ColorPicker.ChannelSliderThumb />
              </ColorPicker.ChannelSliderTrack>
            </ColorPicker.ChannelSlider>
            <ColorPicker.SwatchGroup>
              {props.swatches.map((c) => (
                <ColorPicker.SwatchTrigger key={c} color={c}>
                  <ColorPicker.Swatch color={c} aria-hidden="true" />
                  <ColorPicker.SwatchIndicator />
                </ColorPicker.SwatchTrigger>
              ))}
            </ColorPicker.SwatchGroup>
            <ColorPicker.ChannelInput channel="hex" />
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}
