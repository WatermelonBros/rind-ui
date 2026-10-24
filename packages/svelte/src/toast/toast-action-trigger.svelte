<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { toastHost, useButton } from "./context.svelte"
import type { ToastButtonProps } from "./types"

const { child, children, ...rest }: ToastButtonProps = $props()
const ctx = toastHost.get()
const b = useButton(() =>
  ctx.region.store
    .service(ctx.toast().instance)
    ?.send({ type: "ACTION_PRESS", modality: "pointer" }),
)
const toast = $derived(ctx.toast())
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.region.api().actionTrigger(toast, b.state)),
        b.press.props,
        b.handlers,
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: toast })}
{:else}
  <button {...merged as HTMLButtonAttributes}
    >{#if children}{@render children(toast)}{:else}{toast.data.action?.label}{/if}</button
  >
{/if}
