<script lang="ts">
import { jsonItemConnect } from "@rind-ui/core"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useNode } from "./context"
import type { JsonTreeViewPartProps } from "./types"

const { children, ...rest }: JsonTreeViewPartProps = $props()
const { ctx, node } = useNode("Value")
const picked = $derived.by(() => {
  const n = node()
  if (!n) return undefined
  const a = jsonItemConnect({
    instance: ctx.instance(),
    node: n,
    messages: ctx.messages(),
    maxPreviewItems: ctx.maxPreviewItems(),
  })
  return { attrs: mergeProps(normalizeProps(a.value()), rest), text: a.valueText }
})
</script>

{#if picked}<span {...attrs(picked.attrs)}>{#if children}{@render children()}{:else}{picked.text}{/if}</span>{/if}
