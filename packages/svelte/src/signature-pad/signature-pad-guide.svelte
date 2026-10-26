<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { signaturePadContext } from "./context"
import type { SignaturePadGuideProps } from "./types"

const { child, children, ...rest }: SignaturePadGuideProps = $props()
const ctx = signaturePadContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().guide()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
