<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { fileUploadContext, fileUploadItem } from "./context"
import type { FileUploadItemProps } from "./types"

const { file, child, children, ...rest }: FileUploadItemProps = $props()
const ctx = fileUploadContext.get()
const index = $derived(ctx.state().files.indexOf(file))
fileUploadItem.set({ file: () => file, index: () => index })
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(index)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <li {...attrs(merged)}>{@render children?.(ctx.state())}</li>
{/if}
