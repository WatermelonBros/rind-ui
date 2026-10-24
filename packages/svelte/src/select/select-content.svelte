<script lang="ts">
import { selectLayerId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePresence } from "../use-presence.svelte"
import { api, selectHost } from "./context.svelte"
import type { SelectContentProps } from "./types"

const { child, children, ...rest }: SelectContentProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
provideLayer(
  () => selectLayerId(ctx.instance()),
  () => "listbox",
)
const el = elementRef("div")
const open = $derived(ctx.view().matches("open"))
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted },
)
const exiting = $derived(!open && presence.state === "exiting")
// The scroll lock writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(api(ctx, env).content()),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: true } : {}),
          ...el.props,
        },
        rest,
      ),
    ),
  ),
)
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
