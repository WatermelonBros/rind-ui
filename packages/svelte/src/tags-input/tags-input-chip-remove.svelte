<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputChip, tagsInputHost } from "./context"
import type { TagsInputChipRemoveProps } from "./types"

const { child, children, ...rest }: TagsInputChipRemoveProps = $props()
const host = tagsInputHost.get()
const chip = tagsInputChip.maybe()
if (!chip) throw new Error("TagsInput.ChipRemove must be inside TagsInput.Chips")
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.api().chipRemove(chip().key)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}
    >{#if children}{@render children()}{:else}<span aria-hidden="true">×</span>{/if}</button
  >
{/if}
