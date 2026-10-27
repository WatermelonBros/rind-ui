<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { citationContext } from "./context"
import type { CitationPartProps } from "./types"

type Kind = "source" | "sourceTitle" | "sourceUrl" | "sourceSnippet" | "sourceLink" | "citedText"
const TAG: Record<Kind, string> = {
  source: "div",
  sourceTitle: "p",
  sourceUrl: "span",
  sourceSnippet: "span",
  sourceLink: "a",
  citedText: "span",
}

/** A source part whose default text comes from the source. */
const { kind, child, children, ...rest }: CitationPartProps & { kind: Kind } = $props()
const ctx = citationContext.get()
const text = $derived(
  kind === "sourceTitle"
    ? ctx.source()?.title
    : kind === "sourceUrl"
      ? ctx.api().domain
      : kind === "sourceSnippet"
        ? ctx.source()?.snippet
        : kind === "sourceLink"
          ? ctx.api().href
          : undefined,
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api()[kind]()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <svelte:element this={TAG[kind]} {...attrs(merged) as Record<string, unknown>}>{#if children}{@render children(ctx.state())}{:else}{text ?? ""}{/if}</svelte:element>
{/if}
