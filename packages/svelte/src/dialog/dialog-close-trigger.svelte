<script lang="ts">
import { closeOnSubmit, stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { dialogApi, dialogHost, partIdOf, useButton } from "./context.svelte"
import type { DialogButtonProps } from "./types"

const { id, child, children, ...rest }: DialogButtonProps = $props()
const ctx = dialogHost.get()
const uid = $props.id()
const closeId = $derived(partIdOf(ctx, "close", id ?? undefined, uid))
const el = elementRef("button")
const b = useButton((m) => closeOnSubmit(b.env, closeId, () => dialogApi(ctx).pressClose(m)))
// No content of its own (an icon): named by messages.close.
let empty = $state(false)
$effect(() => {
  void children
  empty = (el.current?.textContent ?? "").trim() === ""
})
const merged = $derived.by(() => {
  const own = normalizeProps(
    dialogApi(ctx).closeTrigger({
      id: closeId,
      focused: b.focused,
      modality: b.modality,
      pressed: b.press.pressed,
      empty,
    }),
  )
  return stripMarker(
    mergeProps({ ...joinHandlers(own, b.press.props, b.handlers), ...el.props }, rest),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
