<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputChip, tagsInputHost } from "./context"
import type { TagsInputChipTextProps } from "./types"

const { child, children, ...rest }: TagsInputChipTextProps = $props()
const host = tagsInputHost.get()
const chip = tagsInputChip.maybe()
if (!chip) throw new Error("TagsInput.ChipText must be inside TagsInput.Chips")
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.api().chipText(chip().key)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children()}{:else}{chip().text}{/if}</span>
{/if}
