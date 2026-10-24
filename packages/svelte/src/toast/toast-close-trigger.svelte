<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { toastHost, useButton } from "./context.svelte"
import type { ToastButtonProps } from "./types"

const { child, children, ...rest }: ToastButtonProps = $props()
const ctx = toastHost.get()
const b = useButton(() =>
  ctx.region.store
    .service(ctx.toast().instance)
    ?.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" }),
)
const el = elementRef("button")
let empty = $state(false)
$effect(() => {
  void children
  empty = (el.current?.textContent ?? "").trim() === ""
})
const toast = $derived(ctx.toast())
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.region.api().closeTrigger(toast, { ...b.state, empty })),
          b.press.props,
          b.handlers,
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: toast })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(toast)}</button>
{/if}
