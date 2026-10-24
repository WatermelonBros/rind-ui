<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useIcon } from "../provider"
import { clipboardContext } from "./context.svelte"
import type { ClipboardIndicatorProps } from "./types"

const { copied, failed, child, children, ...rest }: ClipboardIndicatorProps = $props()
const ctx = clipboardContext.get()
const icons = { copy: useIcon("copy"), check: useIcon("check"), x: useIcon("x") }
const copyState = $derived(ctx.state().copyState)
const own = $derived(
  copyState === "copied"
    ? (copied ?? children)
    : copyState === "error"
      ? (failed ?? children)
      : children,
)
// Else the provider's icon for the state (Copy, Check, X); else nothing: the theme draws it.
const Icon = $derived(
  icons[copyState === "copied" ? "check" : copyState === "error" ? "x" : "copy"](),
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if own}{@render own(ctx.state())}{:else if Icon}<Icon />{/if}</span>
{/if}
