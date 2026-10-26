<script lang="ts">
import { jsonItemConnect, toKey } from "@rind-ui/core"
import TreeItem from "../tree-view/tree-view-item.svelte"
import { jsonContext } from "./context"
import type { JsonTreeViewItemProps } from "./types"

/** A Tree View item with the JSON attributes (`data-type`, `data-key`, `data-range`, …). */
const itemProps: JsonTreeViewItemProps = $props()
const ctx = jsonContext.get()
const json = $derived.by(() => {
  const n = ctx.node(toKey(itemProps.value))
  return n
    ? // Only `data-*` strings: nothing to normalise.
      (jsonItemConnect({
        instance: ctx.instance(),
        node: n,
        messages: ctx.messages(),
      }).item() as Record<`data-${string}`, string | undefined>)
    : {}
})
</script>

<TreeItem {...json} {...itemProps} />
