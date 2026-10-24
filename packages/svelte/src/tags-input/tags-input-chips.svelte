<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputHost } from "./context"
import Chip from "./tags-input-chip.svelte"
import ChipInput from "./tags-input-chip-input.svelte"
import ChipRemove from "./tags-input-chip-remove.svelte"
import ChipScope from "./tags-input-chip-scope.svelte"
import ChipText from "./tags-input-chip-text.svelte"
import type { TagsInputChipsProps } from "./types"

// The chips toolbar: one Chip per tag, before the Input.
const { child, children, ...rest }: TagsInputChipsProps = $props()
const host = tagsInputHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chips()), rest)))
</script>

{#snippet content()}{#each host.chips() as chip (chip.key)}<ChipScope {chip}
      >{#if children}{@render children(chip)}{:else}<Chip><ChipText /><ChipInput /><ChipRemove /></Chip
        >{/if}</ChipScope
    >{/each}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
