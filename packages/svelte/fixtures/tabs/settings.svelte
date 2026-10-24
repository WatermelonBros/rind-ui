<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, Tabs } from "../../src/index"

const TABS = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "team", label: "Team" },
]
const {
  root = {},
  disabled = [],
  provider = true,
}: { root?: Record<string, unknown>; disabled?: readonly string[]; provider?: boolean } = $props()
</script>

{#snippet tree()}
  <Tabs.Root {...root}>
    <Tabs.List aria-label="Settings">
      {#each TABS as t (t.value)}<Tabs.Tab value={t.value} disabled={disabled.includes(t.value)}>{t.label}</Tabs.Tab>{/each}
    </Tabs.List>
    {#each TABS as t (t.value)}<Tabs.Panel value={t.value}>{t.label} settings</Tabs.Panel>{/each}
  </Tabs.Root>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction ?? "ltr"}>
    {@render tree()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render tree()}
{/if}
