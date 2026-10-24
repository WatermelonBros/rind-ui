<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { fileUploadContext, fileUploadItem } from "./context"
import type { FileUploadButtonProps } from "./types"

const { child, children, ...rest }: FileUploadButtonProps = $props()
const ctx = fileUploadContext.get()
const item = fileUploadItem.get()
const named = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().itemRemove(item.file(), named)), {
        onclick: () => {
          ctx.focusAfterRemoval.current = item.index()
          ctx.send({ type: "FILE.REMOVE", file: item.file() })
        },
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
