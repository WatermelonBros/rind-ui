<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagGroupHost, tagGroupList } from "./context"
import type { TagGroupDivProps } from "./types"

const { child, children, ...rest }: TagGroupDivProps = $props()
const host = tagGroupHost.get()
const inList = tagGroupList.maybe() ?? false
$effect(() => {
  if (DEV && !inList)
    console.warn("[rind-ui] TagGroup: Empty is outside List; render it inside TagGroup.List.")
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().empty()), rest)))
</script>

{#if host.parts().isEmpty}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
