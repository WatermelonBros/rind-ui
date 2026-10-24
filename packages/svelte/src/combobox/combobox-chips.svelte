<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import Chip from "./combobox-chip.svelte"
import ChipRemove from "./combobox-chip-remove.svelte"
import ChipScope from "./combobox-chip-scope.svelte"
import { comboboxHost } from "./context"
import type { ComboboxChipsProps } from "./types"

// The chips toolbar (multiple): one Chip per selected option, before the Input.
const { child, children, ...rest }: ComboboxChipsProps = $props()
const host = comboboxHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chips()), rest)))
</script>

{#snippet content()}{#each host.chips() as chip (chip.key)}<ChipScope chip={chip.key}
      >{#if children}{@render children(chip)}{:else}<Chip>{chip.text}<ChipRemove /></Chip
        >{/if}</ChipScope
    >{/each}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
