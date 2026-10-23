<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { untrack } from "svelte"
import { Rating, RindProvider } from "../../src/index"

const {
  root = {},
  applying,
  provider = true,
}: { root?: Record<string, unknown>; applying?: number; provider?: boolean } = $props()
// Controlled by a parent that applies every proposal (the oracle runs uncontrolled).
let value = $state(untrack(() => applying))
</script>

{#snippet rating()}
  {#if applying !== undefined}
    <Rating.Root name="score" bind:value defaultValue={applying}>
      <Rating.Label>Score</Rating.Label>
      <Rating.Control>{#each [1, 2, 3, 4, 5] as i (i)}<Rating.Item index={i} style="display: inline-block; width: 24px; height: 24px" />{/each}</Rating.Control>
    </Rating.Root>
  {:else}
    <Rating.Root name="score" {...root}>
      <Rating.Label>Score</Rating.Label>
      <Rating.Control>{#each [1, 2, 3, 4, 5] as i (i)}<Rating.Item index={i} style="display: inline-block; width: 24px; height: 24px" />{/each}</Rating.Control>
    </Rating.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider dir={currentRun()?.direction ?? "ltr"} environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <form>{@render rating()}<button type="reset">Reset</button></form>
  </RindProvider>
{:else}
  {@render rating()}
{/if}
