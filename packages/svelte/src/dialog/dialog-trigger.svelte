<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { dialogApi, dialogHost, isOpen, partIdOf, useButton } from "./context.svelte"
import type { DialogTriggerProps } from "./types"

const { id, disabled = false, child, children, ...rest }: DialogTriggerProps = $props()
const ctx = dialogHost.get()
const uid = $props.id()
const triggerId = $derived(partIdOf(ctx, "trigger", id ?? undefined, uid))
const b = useButton(
  (m) => dialogApi(ctx).pressTrigger(triggerId, m),
  () => disabled === true,
)
const merged = $derived.by(() => {
  const own = normalizeProps(
    dialogApi(ctx).trigger({
      id: triggerId,
      focused: b.focused,
      modality: b.modality,
      pressed: b.press.pressed,
      disabled: disabled === true,
    }),
  )
  return stripMarker(
    mergeProps(
      { ...joinHandlers(own, b.press.props, b.handlers), ...(disabled ? { disabled: true } : {}) },
      rest,
    ),
  )
})
const current = $derived({ open: isOpen(ctx) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
