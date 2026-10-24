<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { fileUploadContext } from "./context"
import type { FileUploadItemGroupProps } from "./types"

const { child, children, ...rest }: FileUploadItemGroupProps = $props()
const ctx = fileUploadContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().itemGroup()), rest)))
</script>

{#if ctx.state().files.length > 0}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <ul {...attrs(merged)}>{@render children?.(ctx.state())}</ul>
  {/if}
{/if}
