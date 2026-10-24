<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { toastHost } from "./context.svelte"
import type { ToastTextProps } from "./types"

const { child, children, ...rest }: ToastTextProps = $props()
const ctx = toastHost.get()
// Untracked: registering reads and writes the slot's state, which this effect must not depend on.
$effect(() =>
  untrack(() => {
    ctx.mount("description", true)
    return () => ctx.mount("description", false)
  }),
)
const toast = $derived(ctx.toast())
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.region.api().description(toast)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: toast })}
{:else}
  <div {...attrs(merged)}>{#if children}{@render children(toast)}{:else}{toast.data.description}{/if}</div>
{/if}
