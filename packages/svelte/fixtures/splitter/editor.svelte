<script lang="ts">
import { platforms, type SplitterPanel } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { untrack } from "svelte"
import { RindProvider, Splitter } from "../../src/index"

const {
  root,
  applying,
  provider = true,
}: {
  root: Record<string, unknown> & { panels: readonly SplitterPanel[] }
  applying?: number[]
  provider?: boolean
} = $props()
const NAMES = ["Sidebar", "Editor", "Preview"]
let sizes: readonly number[] | undefined = $state(untrack(() => applying))
const vertical = $derived(root["orientation"] === "vertical")
const length = $derived(400 + (root.panels.length - 1) * 10)
const style = $derived(
  vertical ? `width: 200px; height: ${length}px` : `width: ${length}px; height: 100px`,
)
</script>

{#snippet parts()}
  {#each root.panels as _, i (i)}<Splitter.Panel index={i}>{NAMES[i]}</Splitter.Panel>{#if i < root.panels.length - 1}<Splitter.Handle index={i} aria-label={NAMES[i]} style={vertical ? "height: 10px" : "width: 10px"} />{/if}{/each}
{/snippet}

{#snippet splitter()}
  {#if applying}
    <Splitter.Root {...root} bind:sizes {style}>{@render parts()}</Splitter.Root>
  {:else}
    <Splitter.Root {...root} {style}>{@render parts()}</Splitter.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider dir={currentRun()?.direction ?? "ltr"} environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render splitter()}</RindProvider>
{:else}
  {@render splitter()}
{/if}
