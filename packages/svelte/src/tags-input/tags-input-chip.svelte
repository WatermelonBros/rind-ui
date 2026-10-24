<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputChip, tagsInputHost } from "./context"
import type { TagsInputChipProps } from "./types"

const { child, children, disabled = false, ...rest }: TagsInputChipProps = $props()
const host = tagsInputHost.get()
const chip = tagsInputChip.maybe()
if (!chip) throw new Error("TagsInput.Chip must be inside TagsInput.Chips")
$effect(() => {
  const key = chip().key
  const on = disabled === true
  untrack(() => host.setDisabled(key, on))
  return () => host.setDisabled(key, false)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chip(chip().key)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
