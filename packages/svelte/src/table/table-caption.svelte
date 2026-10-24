<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { tableHost } from "./context.svelte"
import type { TableCaptionProps } from "./types"

const { id, child, children, ...rest }: TableCaptionProps = $props()
const ctx = tableHost.get()
const own = $derived(id ?? `table-${ctx.instance()}-caption`)
useRegisterPart(ctx.registry, "caption", () => own)
$effect.pre(() => {
  const frame = ctx.frame
  if (!frame) return
  frame.shared.caption = own
  return () => (frame.shared.caption = undefined)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().caption(own)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <caption {...attrs(merged)}>{@render children?.(ctx.state())}</caption>
{/if}
