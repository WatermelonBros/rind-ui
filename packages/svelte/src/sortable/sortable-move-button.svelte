<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { sortableHost, sortableItem } from "./context"
import type { SortableMoveButtonProps } from "./types"

const { direction, child, children, ...rest }: SortableMoveButtonProps = $props()
const ctx = sortableHost.get()
const key = sortableItem.get()
const merged = $derived.by(() => {
  const own = ctx.api().moveButton(key(), direction)
  return stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(own), {
        onclick: () => {
          if (own["aria-disabled"] !== "true") {
            ctx.send({ type: "QUICK", key: key(), by: direction === "up" ? -1 : 1 })
          }
        },
      }),
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
