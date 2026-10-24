<script lang="ts">
import { checkTagGroupList } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagGroupHost, tagGroupList } from "./context"
import type { TagGroupDivProps } from "./types"

const { child, children, ...rest }: TagGroupDivProps = $props()
const host = tagGroupHost.get()
tagGroupList.set(true)
const el = elementRef("div")
// After the update a Label's registration causes, not on the first mount.
$effect(() => {
  const node = el.current
  const interactive = host.parts().interactive
  queueMicrotask(() => {
    if (node instanceof HTMLElement && node.isConnected) checkTagGroupList(node, interactive)
  })
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          host.parts().list({
            "aria-label": rest["aria-label"] ?? undefined,
            "aria-labelledby": rest["aria-labelledby"] ?? undefined,
          }),
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
