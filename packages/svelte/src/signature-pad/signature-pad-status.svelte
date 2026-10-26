<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { signaturePadContext } from "./context"
import type { SignaturePadStatusProps } from "./types"

const { id, child, children, ...rest }: SignaturePadStatusProps = $props()
const ctx = signaturePadContext.get()
const own = $derived(id ?? ctx.ids().status)
useRegisterPart(ctx.registry, "status", () => own)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().status()), id: own }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().statusText}{/if}</span>
{/if}
