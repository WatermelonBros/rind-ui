<script lang="ts">
import { jsonItemConnect } from "@rind-ui/core"
import { useNode } from "./context"
import Key from "./json-tree-view-key.svelte"
import Preview from "./json-tree-view-preview.svelte"
import Separator from "./json-tree-view-separator.svelte"
import Summary from "./json-tree-view-summary.svelte"
import SummaryText from "./json-tree-view-summary-text.svelte"
import Value from "./json-tree-view-value.svelte"

/** An item's default text: Key, Separator, then Value or Summary, SummaryText and Preview. */
const { ctx, node } = useNode("Content")
const n = $derived(node())
const container = $derived(
  n ? jsonItemConnect({ instance: "", node: n, messages: ctx.messages() }).isContainer : false,
)
</script>

<!-- A space after the ":" separator: "name: Ada". -->
{#if n}{#if n.label !== null || n.type === "range"}<Key />{#if n.type !== "range"}<Separator />{/if}{" "}{/if}{#if container}<Summary /><SummaryText />{#if !ctx.expanded().has(n.key) && n.count > 0}<Preview />{/if}{:else if n.type !== "range"}<Value />{/if}{/if}
