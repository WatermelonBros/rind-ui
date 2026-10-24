<script lang="ts">
import { type OverflowWatch, watchOverflow } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import VisuallyHidden from "../visually-hidden.svelte"
import Line from "./code-block-line.svelte"
import { codeBlockContext } from "./context"
import type { CodeBlockContentProps } from "./types"

const { child, children, ...rest }: CodeBlockContentProps = $props()
const ctx = codeBlockContext.get()
const el = elementRef("pre")
let overflow: OverflowWatch | null = null
$effect(() => {
  const node = el.current
  if (!(node instanceof HTMLElement)) return
  return untrack(() => {
    const w = watchOverflow(node, (o) => ctx.send({ type: "OVERFLOW.CHANGE", overflow: o }))
    overflow = w
    return () => {
      w.stop()
      overflow = null
    }
  })
})
// Wrap, expansion and the code change the content's layout: measure again after the update.
$effect(() => {
  void ctx.state().wrapped
  void ctx.state().expanded
  void ctx.lines()
  untrack(() => overflow?.remeasure())
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().content()), ...el.props }, rest)),
)
const description = $derived(ctx.api().descriptionText)
</script>

{#snippet body()}<code {...attrs(normalizeProps(ctx.api().code()))}
    >{#each ctx.lines() as line (line.index)}{#if line.index > 0}{"\n"}{/if}{#if children}{@render children(
          line,
        )}{:else}<Line {line} />{/if}{/each}</code
  >{/snippet}

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <pre {...attrs(merged)}>{@render body()}</pre>
{/if}
{#if description}
  <VisuallyHidden {...normalizeProps(ctx.api().description())}>{description}</VisuallyHidden>
{/if}
