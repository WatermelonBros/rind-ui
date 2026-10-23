<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { breadcrumbsContext } from "./context"
import type { BreadcrumbsEllipsisProps, BreadcrumbsEllipsisState } from "./types"

/**
 * The collapsed items' place in the list, only while items are collapsed. Place it after the
 * first `itemsBeforeCollapse` Items; `children` usually renders a Menu (or Popover) whose
 * trigger is named `label`.
 */
const { child, children, ...rest }: BreadcrumbsEllipsisProps = $props()
const root = breadcrumbsContext.get()
const count = $derived(root.trail().collapsed.length)
const label = $derived(root.messages().showCollapsed(count))
const own = $derived(root.connect().ellipsis(label))
const current: BreadcrumbsEllipsisState = $derived({
  items: root.trail().collapsed.flatMap((key) => {
    const it = root.items().find((i) => i.key === key)
    return it
      ? [
          {
            key: it.key,
            textValue: it.textValue,
            href: it.href,
            routerOptions: it.routerOptions,
            disabled: it.disabled,
          },
        ]
      : []
  }),
  label,
  count,
})
const merged = $derived(own ? stripMarker(mergeProps(normalizeProps(own), rest)) : null)
</script>

{#if merged}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <li {...attrs(merged)}>{@render children?.(current)}</li>
  {/if}
{/if}
