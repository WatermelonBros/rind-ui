<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuLevel } from "./context.svelte"
import type { MenuItemTextProps } from "./types"

const { child, children, ...rest }: MenuItemTextProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const merged = $derived(stripMarker(mergeProps(normalizeProps(menuApi(ctx, env).itemText()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
