<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuLevel } from "./context.svelte"
import type { MenuArrowProps } from "./types"

const { child, children, ...rest }: MenuArrowProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const merged = $derived(stripMarker(mergeProps(normalizeProps(menuApi(ctx, env).arrow()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
