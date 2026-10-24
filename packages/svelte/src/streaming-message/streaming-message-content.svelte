<script lang="ts">
import { streamingMessageConnect } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { streamingMessage } from "./context"
import type { StreamingMessagePartProps } from "./types"

/** The displayed text, plain; or your renderer (markdown) as children, given the state's `text`. */
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
          plain: children === undefined,
        }).content(),
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}
    >{#if children}{@render children(current)}{:else}{current.text}{/if}</div
  >
{/if}
