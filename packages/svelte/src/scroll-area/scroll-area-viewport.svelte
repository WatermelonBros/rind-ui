<script lang="ts">
import { warnUnnamedTabStop } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { scrollAreaContext } from "./context"
import type { ScrollAreaPartProps } from "./types"

/** The native scroll container. */
const { child, children, ...rest }: ScrollAreaPartProps = $props()
const ctx = scrollAreaContext.get()
const named = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
$effect(() => {
  const tabStop = ctx.input().context.tabStop && rest.tabindex === undefined
  const isNamed = named
  untrack(() => warnUnnamedTabStop(tabStop, isNamed))
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.connect().viewport(ctx.send, named)), rest)),
)
const current = $derived({ state: ctx.input().state })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
