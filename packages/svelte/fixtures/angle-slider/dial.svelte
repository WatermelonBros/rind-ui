<script lang="ts">
import { AngleSlider, RindProvider } from "../../src/index"

const {
  root = {},
  full = true,
  onBound = undefined,
}: {
  root?: Record<string, unknown>
  full?: boolean
  onBound?: ((value: number) => void) | undefined
} = $props()
let bound = $state(10)
$effect(() => onBound?.(bound))
</script>

{#snippet dial()}
  <AngleSlider.Root {...(full ? { name: "heading", defaultValue: 90 } : { defaultValue: 45 })} {...root}>
    <AngleSlider.Label>Heading</AngleSlider.Label>
    <AngleSlider.Control>
      <AngleSlider.MarkerGroup>{#each full ? [0, 90, 180, 270] : [90] as v (v)}<AngleSlider.Marker value={v} />{/each}</AngleSlider.MarkerGroup>
      <AngleSlider.Thumb><AngleSlider.Input /></AngleSlider.Thumb>
    </AngleSlider.Control>
    <AngleSlider.Value />
  </AngleSlider.Root>
{/snippet}

{#if onBound}
  <RindProvider locale="en-US"><AngleSlider.Root bind:value={bound} aria-label="Rotation"><AngleSlider.Control><AngleSlider.Input /></AngleSlider.Control></AngleSlider.Root></RindProvider>
{:else if full}
  <RindProvider locale="en-US"><form>{@render dial()}</form></RindProvider>
{:else}
  <RindProvider>{@render dial()}</RindProvider>
{/if}
