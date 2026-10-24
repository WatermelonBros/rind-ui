<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { dialogApi, dialogHost, isOpen } from "./context.svelte"
import type { DialogBackdropProps } from "./types"

const { child, children, ...rest }: DialogBackdropProps = $props()
const ctx = dialogHost.get()
const el = elementRef("div")
const open = $derived(isOpen(ctx))
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted },
)
// The scroll lock writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(dialogApi(ctx).backdrop()),
          hidden: !open && ctx.keepMounted(),
          ...el.props,
        },
        rest,
      ),
    ),
  ),
)
</script>

<!-- Non-modal dialogs render no backdrop: the page stays usable (zag#3401). -->
{#if ctx.modal() && presence.mounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
