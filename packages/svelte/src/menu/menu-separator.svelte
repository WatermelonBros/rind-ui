<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuLevel } from "./context.svelte"
import type { MenuSeparatorProps } from "./types"

const { orientation, child, children, ...rest }: MenuSeparatorProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const el = elementRef("div")
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(menuApi(ctx, env).separator({ orientation, tag: el.tag })),
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
