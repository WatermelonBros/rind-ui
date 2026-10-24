/** @jsxImportSource solid-js */
import { Slider } from "@rind-ui/solid"

export function Basic() {
  return (
    <Slider.Root defaultValue={40}>
      <Slider.Label>Volume</Slider.Label>
      <Slider.ValueText />
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        <Slider.Thumb index={0} disabled={false} />
      </Slider.Control>
    </Slider.Root>
  )
}
