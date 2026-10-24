<script lang="ts">
import { Marquee, RindProvider } from "../../src/index"

const { root = {}, scheduler }: { root?: Record<string, unknown>; scheduler?: unknown } = $props()
</script>

{#snippet marquee()}
  <Marquee.Root role="region" aria-label="Partners" {...root}>
    <Marquee.PauseTrigger />
    <Marquee.Viewport><Marquee.Content><a href="#acme">Acme</a><a href="#globex">Globex</a></Marquee.Content></Marquee.Viewport>
  </Marquee.Root>
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler, reducedMotion: false } as never}>{@render marquee()}</RindProvider>
{:else}
  {@render marquee()}
{/if}
