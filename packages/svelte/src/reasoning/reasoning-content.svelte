<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { createAttachmentKey } from "svelte/attachments"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { reasoning } from "./context"
import type { ReasoningContentProps } from "./types"

const { child, children, ...rest }: ReasoningContentProps = $props()
const ctx = reasoning.get()
// The machine asks whether focus is inside before it closes automatically.
const attach = createAttachmentKey()
const capture = (node: Element) => {
  ctx.content.current = node
  return () => {
    if (ctx.content.current === node) ctx.content.current = null
  }
}
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().content()), [attach]: capture }, rest)),
)
</script>

{#if ctx.state().open}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
  {/if}
{/if}
