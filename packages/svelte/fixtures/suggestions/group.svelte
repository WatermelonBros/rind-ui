<script lang="ts">
import type { SuggestionsSelectDetails } from "@rind-ui/core"
import { RindProvider, Suggestions } from "../../src/index"

const {
  items,
  loading = false,
  disabled = false,
  announce,
  label,
  provider,
  onSelect,
}: {
  items: string[]
  loading?: boolean
  disabled?: boolean
  announce?: "off" | "polite"
  label?: string
  provider?: Record<string, unknown>
  onSelect?: (d: SuggestionsSelectDetails) => void
} = $props()
let prompt: HTMLTextAreaElement | undefined = $state()
</script>

{#snippet group()}
  <textarea aria-label="Prompt" bind:this={prompt}></textarea>
  <Suggestions.Root aria-label={label} {loading} {disabled} {announce} {onSelect} focusTarget={() => prompt ?? null}>
    {#each items as text (text)}
      <Suggestions.Item><Suggestions.Label>{text}</Suggestions.Label>{" "}<Suggestions.Description>example</Suggestions.Description></Suggestions.Item>
    {/each}
    <Suggestions.Item value="custom-value" disabled><Suggestions.Label>Off</Suggestions.Label></Suggestions.Item>
  </Suggestions.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render group()}</RindProvider>
{:else}
  {@render group()}
{/if}
