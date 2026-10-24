<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { isNamed, messageThread } from "./context"
import type { MessageThreadJumpToLatestProps } from "./types"

const { child, children, ...rest }: MessageThreadJumpToLatestProps = $props()
const ctx = messageThread.get()
const env = useEnvironment()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().jumpToLatest(isNamed(rest))), {
        onclick: () => ctx.send({ type: "JUMP", modality: env.modality.modality() }),
      }),
      rest,
    ),
  ),
)
</script>

{#if ctx.api().showJump}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <button {...attrs(merged)}>{@render children?.(ctx.state())}</button>
  {/if}
{/if}
