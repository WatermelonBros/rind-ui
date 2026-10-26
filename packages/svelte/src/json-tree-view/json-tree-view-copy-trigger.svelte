<script lang="ts">
import { mergeProps } from "../merge-props"
import { attrs } from "../normalize-props"
import { jsonContext } from "./context"
import type { JsonTreeViewCopyTriggerProps } from "./types"

/** Copies the highlighted item in `copyFormat`; the result is announced. */
const { children, ...rest }: JsonTreeViewCopyTriggerProps = $props()
const ctx = jsonContext.get()
const merged = $derived(
  mergeProps(
    {
      type: "button",
      "data-scope": "json-tree-view",
      "data-part": "copy-trigger",
      "data-instance": ctx.instance(),
      "data-copy-state": ctx.api.copyState,
      onclick: (e: MouseEvent) => ctx.copyFrom(e.currentTarget as Element),
    },
    rest,
  ),
)
</script>

<button {...attrs(merged)}>{#if children}{@render children()}{:else}{ctx.clipboardMessages().copy}{/if}</button>
