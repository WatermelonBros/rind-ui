<script lang="ts">
import { closeOnSubmit, stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { dialogApi, dialogHost, partIdOf, useButton } from "./context.svelte"
import type { DialogButtonProps } from "./types"

// Action: a press-activated button that closes with its own reason.
const { id, disabled = false, child, children, ...rest }: DialogButtonProps = $props()
const ctx = dialogHost.get()
const uid = $props.id()
const own = $derived(partIdOf(ctx, "action", id ?? undefined, uid))
const b = useButton(
  (m) => closeOnSubmit(b.env, own, () => dialogApi(ctx).pressAction(own, m)),
  () => disabled === true,
)
const merged = $derived.by(() => {
  const props = normalizeProps(
    dialogApi(ctx).action({
      id: own,
      focused: b.focused,
      modality: b.modality,
      pressed: b.press.pressed,
      disabled: disabled === true,
    }),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(props, b.press.props, b.handlers),
        ...(disabled ? { disabled: true } : {}),
      },
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
