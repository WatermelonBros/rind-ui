<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { untrack } from "svelte"
import { RindProvider, Slider, type SliderValue } from "../../src/index"

const {
  thumbs = 1,
  root = {},
  disabledThumb,
  applying,
  marked = false,
  provider = true,
}: {
  thumbs?: number
  root?: Record<string, unknown>
  disabledThumb?: number
  applying?: number[]
  marked?: boolean
  provider?: boolean
} = $props()
// Controlled by a parent that applies every proposal (the oracle runs uncontrolled).
let value: SliderValue | undefined = $state(untrack(() => applying))
const control = $derived(
  root["orientation"] === "vertical"
    ? "width: 20px; height: 200px"
    : "width: 200px; height: 20px; margin: 8px 0",
)
</script>

{#snippet parts(n: number)}
  <Slider.Label>Volume</Slider.Label>
  <Slider.ValueText />
  <Slider.Control style={control}>
    <Slider.Track style="position: absolute; inset: 0"><Slider.Indicator /></Slider.Track>
    {#each Array.from({ length: n }, (_, i) => i) as i (i)}<Slider.Thumb index={i} disabled={i === disabledThumb} style="width: 16px; height: 16px; --rind-slider-thumb-size: 16px" />{/each}
  </Slider.Control>
{/snippet}

{#snippet slider()}
  {#if marked}
    <Slider.Root defaultValue={50}>
      <Slider.Label>Level</Slider.Label>
      <Slider.Control><Slider.Thumb index={0} /></Slider.Control>
      <Slider.MarkerGroup>{#each [0, 50, 100] as v (v)}<Slider.Marker value={v} />{/each}</Slider.MarkerGroup>
      <Slider.Description>Pick a level</Slider.Description>
    </Slider.Root>
  {:else if applying}
    <Slider.Root name="v" bind:value defaultValue={applying} {...root}>{@render parts(applying.length)}</Slider.Root>
  {:else}
    <Slider.Root name="v" {...root}>{@render parts(thumbs)}</Slider.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider dir={currentRun()?.direction ?? "ltr"} environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <form>{@render slider()}<button type="reset">Reset</button></form>
  </RindProvider>
{:else}
  {@render slider()}
{/if}
