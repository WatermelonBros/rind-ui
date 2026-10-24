<script lang="ts">
import { Select, type SelectRootProps } from "../../src/index"

const {
  root = {},
  portal = true,
  described = false,
}: { root?: Record<string, unknown>; portal?: boolean; described?: boolean } = $props()
const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]
</script>

<!-- No whitespace between parts: React's markup has none. -->
{#snippet positioner()}
  <Select.Positioner
    ><Select.Content
      ><Select.List
        >{#each ITEMS as i (i.key)}<Select.Item value={i.key}
            ><Select.ItemText>{i.label}</Select.ItemText><Select.ItemIndicator>✓</Select.ItemIndicator
            ></Select.Item
          >{/each}</Select.List
      ></Select.Content
    ></Select.Positioner
  >
{/snippet}

<div id="app">
  <Select.Root {...(root as SelectRootProps)} items={ITEMS} placeholder="Pick one"
    ><Select.Label>Fruit</Select.Label><Select.Trigger
      ><Select.ValueText /><Select.Indicator /></Select.Trigger
    >{#if described}<Select.Description>Pick a fruit.</Select.Description>{/if}{#if portal}<Select.Portal
        >{@render positioner()}</Select.Portal
      >{:else}{@render positioner()}{/if}</Select.Root
  ><button type="button">After</button>
</div>
