/** @jsxImportSource solid-js */
import { NumberInput } from "../../src/number-input"
import { Rating } from "../../src/rating"
import { Slider } from "../../src/slider"

export function App() {
  return (
    <form>
      <Slider.Root name="v" defaultValue={[20, 80]}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.ValueText />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
      <NumberInput.Root name="q" defaultValue={5} min={0} max={10}>
        <NumberInput.Label>Quantity</NumberInput.Label>
        <NumberInput.Control>
          <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
          <NumberInput.Input />
          <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
        </NumberInput.Control>
      </NumberInput.Root>
      <Rating.Root name="score" defaultValue={3}>
        <Rating.Label>Score</Rating.Label>
        <Rating.Control>
          <Rating.Item index={1} />
          <Rating.Item index={2} />
          <Rating.Item index={3} />
        </Rating.Control>
      </Rating.Root>
    </form>
  )
}
