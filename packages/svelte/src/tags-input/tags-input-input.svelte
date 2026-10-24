<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLInputAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { tagsInputHost } from "./context"
import type { TagsInputInputProps } from "./types"

const { child, ...rest }: TagsInputInputProps = $props()
const host = tagsInputHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().input()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- The value attribute follows the text (as React's controlled input). -->
  <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} />
{/if}
