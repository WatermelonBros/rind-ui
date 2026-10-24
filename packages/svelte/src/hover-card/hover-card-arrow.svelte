<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, hoverCardHost } from "./context"
import type { HoverCardArrowProps } from "./types"

const { child, children, ...rest }: HoverCardArrowProps = $props()
const ctx = hoverCardHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx).arrow()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
