<script lang="ts">
import { Slider } from "@rind-ui/svelte"
</script>

<Slider.Root defaultValue={40}>
  <Slider.Label>Volume</Slider.Label>
  <Slider.ValueText />
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
    </Slider.Track>
    <Slider.Thumb index={0} />
  </Slider.Control>
</Slider.Root>
