<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { fileUploadContext } from "./context"
import type { FileUploadButtonProps } from "./types"

const { child, children, ...rest }: FileUploadButtonProps = $props()
const ctx = fileUploadContext.get()
const named = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().clearTrigger(named)), {
        onclick: () => {
          // After a clear: the Trigger (index -1 finds no Remove).
          ctx.focusAfterRemoval.current = -1
          ctx.send({ type: "FILES.CLEAR" })
        },
      }),
      rest,
    ),
  ),
)
</script>

{#if ctx.state().files.length > 0}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
  {/if}
{/if}
