<script lang="ts">
import type { Color } from "@rind-ui/core"
import { ColorWheel, RindProvider } from "../../src/index"

const {
  root = {},
  full = true,
  onBound = undefined,
}: {
  root?: Record<string, unknown>
  full?: boolean
  onBound?: ((value: Color | string) => void) | undefined
} = $props()
let bound: Color | string = $state("hsl(10 100% 50%)")
$effect(() => onBound?.(bound))
</script>

{#snippet wheel()}
  <ColorWheel.Root {...(full ? { name: "accent", defaultValue: "hsl(240 80% 40%)" } : { name: "c", defaultValue: "#3366ff" })} {...root}>
    <ColorWheel.Label>{full ? "Accent hue" : "Hue"}</ColorWheel.Label>
    <ColorWheel.Track><ColorWheel.Thumb><ColorWheel.Input /></ColorWheel.Thumb></ColorWheel.Track>
    <ColorWheel.Value />
  </ColorWheel.Root>
{/snippet}

{#if onBound}
  <RindProvider><ColorWheel.Root bind:value={bound}><ColorWheel.Track><ColorWheel.Input /></ColorWheel.Track></ColorWheel.Root></RindProvider>
{:else if full}
  <RindProvider locale="en-US"><form>{@render wheel()}</form></RindProvider>
{:else}
  <RindProvider>{@render wheel()}</RindProvider>
{/if}
