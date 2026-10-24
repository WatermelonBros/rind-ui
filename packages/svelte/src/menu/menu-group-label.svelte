<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuGroup, menuLevel } from "./context.svelte"
import type { MenuGroupProps } from "./types"

const { child, children, ...rest }: MenuGroupProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const group = menuGroup.maybe()
if (!group) throw new Error("Menu.GroupLabel must be inside Menu.Group")
$effect(() => {
  group.setLabelled(true)
  return () => group.setLabelled(false)
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(menuApi(ctx, env).groupLabel(group.labelId)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
