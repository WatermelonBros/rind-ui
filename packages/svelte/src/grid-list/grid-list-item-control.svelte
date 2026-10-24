<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { gridListHost, gridListItem, useControlFocus } from "./context.svelte"
import type { GridListItemControlProps } from "./types"

/** A control of the row: your button, link or field (through `child`). */
const { child, children, ...rest }: GridListItemControlProps = $props()
const host = gridListHost.get()
const item = gridListItem.maybe()
if (!item) throw new Error("GridList.ItemControl must be inside GridList.Item")
const focus = useControlFocus()
// `type="button"` only for the default element: a substituted field keeps its own type.
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...(child ? {} : { type: "button" }),
        ...normalizeProps(host.parts().itemControl(item(), focus.state())),
        ...focus.handlers,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
