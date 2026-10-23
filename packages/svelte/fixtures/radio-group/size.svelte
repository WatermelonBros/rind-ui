<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RadioGroup, RindProvider } from "../../src/index"

const SIZES = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
]
const {
  defaultValue,
  disabled = [],
  root = {},
  provider = true,
}: {
  defaultValue?: string
  disabled?: readonly string[]
  root?: Record<string, unknown>
  provider?: boolean
} = $props()
</script>

{#snippet form()}
  <form>
    <RadioGroup.Root name="size" {defaultValue} {...root}>
      <RadioGroup.Label>Size</RadioGroup.Label>
      {#each SIZES as s (s.value)}
        <RadioGroup.Item value={s.value} disabled={disabled.includes(s.value)}>
          <RadioGroup.ItemControl><RadioGroup.ItemIndicator /></RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      {/each}
    </RadioGroup.Root>
    <button type="button">After</button>
  </form>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render form()}</RindProvider>
{:else}
  {@render form()}
{/if}
