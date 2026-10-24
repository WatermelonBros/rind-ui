<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { dialogApi, dialogHost, useRegistered } from "./context.svelte"
import type { DialogDescriptionProps } from "./types"

const { child, children, ...rest }: DialogDescriptionProps = $props()
const ctx = dialogHost.get()
useRegistered(ctx, "description")
const merged = $derived(stripMarker(mergeProps(normalizeProps(dialogApi(ctx).description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <p {...attrs(merged)}>{@render children?.()}</p>
{/if}
