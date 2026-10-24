<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { dialogApi, dialogHost, useRegistered } from "./context.svelte"
import type { DialogTitleProps } from "./types"

const { level = 2, child, children, ...rest }: DialogTitleProps = $props()
const ctx = dialogHost.get()
useRegistered(ctx, "title")
$effect.pre(() => {
  ctx.shared.titleLevel = level
})
const el = elementRef(() => `h${level}`)
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(dialogApi(ctx).title({ level, tag: el.tag })), ...el.props },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <svelte:element this={`h${level}`} {...merged as HTMLAttributes<HTMLHeadingElement>}>{@render children?.()}</svelte:element>
{/if}
