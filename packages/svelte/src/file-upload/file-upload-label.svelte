<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { fileUploadContext } from "./context"
import type { FileUploadSpanProps } from "./types"

const { id, child, children, ...rest }: FileUploadSpanProps = $props()
const ctx = fileUploadContext.get()
const own = $derived(id ?? ctx.ids().label)
useRegisterPart(ctx.registry, "label", () => own)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        // A press on the Label focuses the Trigger without opening the chooser.
        ...joinHandlers(normalizeProps(ctx.api().label()), {
          onclick: () => document.getElementById(ctx.ids().trigger)?.focus(),
        }),
        id: own,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
