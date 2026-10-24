<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagGroupHost, tagGroupTag } from "./context"
import type { TagGroupSpanProps } from "./types"

const { child, children, ...rest }: TagGroupSpanProps = $props()
const host = tagGroupHost.get()
const tag = tagGroupTag.maybe()
if (!tag) throw new Error("TagGroup.TagText must be inside TagGroup.Tag")
const href = $derived(tag.href())
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(host.parts().itemText(tag.key())),
        ...(href === undefined ? {} : { href }),
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else if href !== undefined}
  <a {...attrs(merged)}>{@render children?.()}</a>
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
