<script lang="ts">
import DialogTitle from "../dialog/dialog-title.svelte"
import type { DialogTitleProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"

/** Names the panel. */
const props: Record<string, unknown> = $props()
const ctx = floatingPanelContext.get()
const merged = $derived.by(() => {
  const { id: _id, ...own } = normalizeProps(ctx.api().title())
  return mergeProps(own, props)
})
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogTitle {...merged as DialogTitleProps} />
