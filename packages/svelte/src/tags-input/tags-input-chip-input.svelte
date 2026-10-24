<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLInputAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { tagsInputChip, tagsInputHost } from "./context"
import type { TagsInputChipInputProps } from "./types"

// The edit input: rendered only while its chip is edited.
const { child, ...rest }: TagsInputChipInputProps = $props()
const host = tagsInputHost.get()
const chip = tagsInputChip.maybe()
if (!chip) throw new Error("TagsInput.ChipInput must be inside TagsInput.Chips")
const editing = $derived(host.editingKey() === chip().key)
const merged = $derived(
  editing ? stripMarker(mergeProps(normalizeProps(host.api().chipInput(chip().key)), rest)) : {},
)
</script>

{#if editing}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} />
  {/if}
{/if}
