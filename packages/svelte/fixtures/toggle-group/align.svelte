<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, ToggleGroup, type ToggleGroupRootProps } from "../../src/index"

const ITEMS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
]
let {
  root = {},
  disabled = [],
  provider = true,
  value = $bindable(),
}: {
  root?: Partial<ToggleGroupRootProps>
  disabled?: readonly string[]
  provider?: boolean
  value?: readonly string[]
} = $props()
</script>

{#snippet group()}
  {#if value === undefined}
    <ToggleGroup.Root aria-label="Alignment" {...root}>
      {#each ITEMS as i (i.value)}
        <ToggleGroup.Item value={i.value} disabled={disabled.includes(i.value)}>{i.label}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  {:else}
    <ToggleGroup.Root aria-label="Alignment" {...root} bind:value>
      {#each ITEMS as i (i.value)}
        <ToggleGroup.Item value={i.value} disabled={disabled.includes(i.value)}>{i.label}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  {/if}
  <button type="button">After</button>
{/snippet}

{#if provider}
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    dir={currentRun()?.direction ?? "ltr"}
  >
    {@render group()}
  </RindProvider>
{:else}
  <div>{@render group()}</div>
{/if}
