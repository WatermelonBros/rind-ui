<script lang="ts">
import { Carousel, RindProvider } from "../../src/index"

const {
  root = {},
  full = true,
  provider = {},
  onBound = undefined,
}: {
  root?: Record<string, unknown>
  full?: boolean
  provider?: Record<string, unknown>
  onBound?: ((page: number) => void) | undefined
} = $props()
let bound = $state(0)
$effect(() => onBound?.(bound))
</script>

{#snippet gallery()}
  <Carousel.Root aria-label="Featured" {...root}>
    <Carousel.Viewport>{#each [0, 1, 2, 3] as i (i)}<Carousel.Slide index={i}>Slide {i + 1}</Carousel.Slide>{/each}</Carousel.Viewport>
    <Carousel.Control><Carousel.PrevTrigger>‹</Carousel.PrevTrigger><Carousel.NextTrigger>›</Carousel.NextTrigger><Carousel.AutoplayTrigger>⏯</Carousel.AutoplayTrigger></Carousel.Control>
    <Carousel.IndicatorGroup>{#snippet children({ pages })}{#each Array.from({ length: pages }, (_, p) => p) as p (p)}<Carousel.Indicator index={p} />{/each}{/snippet}</Carousel.IndicatorGroup>
    <Carousel.Status />
  </Carousel.Root>
{/snippet}

{#if onBound}
  <RindProvider><Carousel.Root aria-label="Featured" bind:page={bound}><Carousel.Viewport>{#each [0, 1, 2] as i (i)}<Carousel.Slide index={i}>{i}</Carousel.Slide>{/each}</Carousel.Viewport><Carousel.NextTrigger>›</Carousel.NextTrigger></Carousel.Root></RindProvider>
{:else if full}
  <RindProvider {...provider}>{@render gallery()}</RindProvider>
{:else}
  <RindProvider><Carousel.Root aria-label="Featured" slideCount={2}><Carousel.Viewport><Carousel.Slide index={0}>A</Carousel.Slide><Carousel.Slide index={1}>B</Carousel.Slide></Carousel.Viewport><Carousel.NextTrigger>›</Carousel.NextTrigger><Carousel.IndicatorGroup><Carousel.Indicator index={0} /><Carousel.Indicator index={1} /></Carousel.IndicatorGroup><Carousel.Status /></Carousel.Root></RindProvider>
{/if}
