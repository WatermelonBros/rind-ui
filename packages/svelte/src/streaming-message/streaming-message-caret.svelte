<script lang="ts">
import { streamingMessageConnect } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { streamingMessage } from "./context"
import type { StreamingMessagePartProps } from "./types"

const { child, children, ...rest }: StreamingMessagePartProps = $props()
const ctx = streamingMessage.get()
const current = $derived(ctx.state())
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(
        streamingMessageConnect({
          instance: ctx.instance(),
          state: current.state,
          plain: false,
        }).caret(),
      ),
      rest,
    ),
  ),
)
</script>

{#if current.busy}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <span {...attrs(merged)}>{@render children?.(current)}</span>
  {/if}
{/if}
