<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { fileUploadContext } from "./context"
import type { FileUploadButtonProps } from "./types"

const { child, children, ...rest }: FileUploadButtonProps = $props()
const ctx = fileUploadContext.get()
ctx.hasTrigger.current = true
const env = useEnvironment()
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const named = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().trigger({ focused, modality: modality.current, named })),
        {
          onclick: () => ctx.send({ type: "PICKER.OPEN" }),
          onfocus: () => (focused = true),
          onblur: () => (focused = false),
        },
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
