<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageCropper } from "./context"
import type { ImageCropperHandleProps } from "./types"

const { position, child, children, ...rest }: ImageCropperHandleProps = $props()
const ctx = imageCropper.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().handle(position)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
