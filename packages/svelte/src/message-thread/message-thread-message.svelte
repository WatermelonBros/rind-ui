<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { isNamed, messageThread } from "./context"
import { useFocusState } from "./focus-state.svelte"
import type { MessageThreadMessageProps } from "./types"

const { index, from, child, children, ...rest }: MessageThreadMessageProps = $props()
const ctx = messageThread.get()
const focusState = useFocusState()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(
          ctx.api().message({ index, from, named: isNamed(rest), focus: focusState.focus() }),
        ),
        focusState.handlers,
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
