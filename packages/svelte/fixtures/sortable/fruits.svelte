<script lang="ts">
import { RindProvider, Sortable } from "../../src/index"

const {
  disabled = [],
  hide,
  buttons = false,
  orientation,
  handle,
  onReorder,
  announcer,
  provider = true,
  extras = true,
}: {
  disabled?: readonly string[]
  hide?: string
  buttons?: boolean
  orientation?: "vertical" | "horizontal"
  handle?: boolean
  onReorder?: (keys: readonly string[]) => void
  announcer?: never
  provider?: boolean
  /** The sized items, the indicator and the Elsewhere button (driver tests). */
  extras?: boolean
} = $props()
const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }
let items = $state.raw<readonly string[]>(["apple", "banana", "cherry"])
const shown = $derived(items.filter((k) => k !== hide))
</script>

{#snippet list()}
  <Sortable.Root
    aria-label="Fruits"
    items={shown}
    {...orientation ? { orientation } : {}}
    {...handle === undefined ? {} : { handle }}
    onReorder={(keys) => {
      onReorder?.(keys)
      items = keys
    }}
  >
    {#each shown as k (k)}
      {#if extras}
        <Sortable.Item value={k} disabled={disabled.includes(k)} style="height: 40px">
          <Sortable.Handle style="width: 24px; height: 24px" />
          <span>{LABELS[k]}</span>
          {#if buttons}
            <Sortable.MoveButton direction="up" />
            <Sortable.MoveButton direction="down" />
          {/if}
        </Sortable.Item>
      {:else}
        <Sortable.Item value={k}>
          <Sortable.Handle />
          <span>{LABELS[k]}</span>
          <Sortable.MoveButton direction="up" />
          <Sortable.MoveButton direction="down" />
        </Sortable.Item>
      {/if}
    {/each}
    {#if extras}<Sortable.Indicator />{/if}
  </Sortable.Root>
  {#if extras}<button type="button">Elsewhere</button>{/if}
{/snippet}

{#if provider}
  <RindProvider {...announcer ? { announcer } : {}}>{@render list()}</RindProvider>
{:else}
  {@render list()}
{/if}
