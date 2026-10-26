<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { keep, toolCallContext } from "./context"
import type { ToolCallPartProps } from "./types"

type Kind =
  | "name"
  | "status"
  | "duration"
  | "content"
  | "input"
  | "output"
  | "error"
  | "approval"
  | "approvalTitle"
  | "approvalDescription"
  | "receipt"

/** A part whose attributes and default text come from the call. */
const { kind, child, children, ...rest }: ToolCallPartProps & { kind: Kind } = $props()
const ctx = toolCallContext.get()
const tag = $derived(kind === "name" || kind === "status" || kind === "duration" ? "span" : "div")
const text = $derived(
  kind === "name"
    ? ctx.name()
    : kind === "status"
      ? ctx.api().statusText
      : kind === "duration"
        ? ctx.api().durationText
        : kind === "receipt"
          ? ctx.api().receiptText
          : "",
)
const shown = $derived(kind !== "approval" || ctx.api().showsApproval)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api()[kind]()), rest)))
const attach = (node: HTMLElement) =>
  kind === "approval"
    ? keep(ctx.approvalEl)(node)
    : kind === "receipt"
      ? keep(ctx.receiptEl)(node)
      : undefined
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <svelte:element this={tag} {...attrs(merged) as Record<string, unknown>} {@attach attach}>{#if children}{@render children(ctx.state())}{:else}{text}{/if}</svelte:element>
  {/if}
{/if}
