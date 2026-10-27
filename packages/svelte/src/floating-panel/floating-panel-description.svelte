<script lang="ts">
import DialogDescription from "../dialog/dialog-description.svelte"
import type { DialogDescriptionProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"

/** Describes the panel. */
const props: Record<string, unknown> = $props()
const ctx = floatingPanelContext.get()
const merged = $derived.by(() => {
  const { id: _id, ...own } = normalizeProps(ctx.api().description())
  return mergeProps(own, props)
})
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogDescription {...merged as DialogDescriptionProps} />
