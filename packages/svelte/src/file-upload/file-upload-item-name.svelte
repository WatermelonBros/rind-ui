<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { fileUploadContext, fileUploadItem } from "./context"
import type { FileUploadSpanProps } from "./types"

const { child, children, ...rest }: FileUploadSpanProps = $props()
const ctx = fileUploadContext.get()
const item = fileUploadItem.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().itemName()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{item.file().name}{/if}</span>
{/if}
