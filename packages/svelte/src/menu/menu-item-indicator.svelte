<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuItemState, menuLevel } from "./context.svelte"
import type { MenuItemIndicatorProps } from "./types"

const { keepMounted = false, child, children, ...rest }: MenuItemIndicatorProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const item = menuItemState.maybe()
if (!item) throw new Error("Menu.ItemIndicator must be inside a checkbox or radio item")
const checked = $derived(item.checked())
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(menuApi(ctx, env).itemIndicator(checked)), rest)),
)
</script>

{#if checked || keepMounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <span {...attrs(merged)}>{@render children?.()}</span>
  {/if}
{/if}
