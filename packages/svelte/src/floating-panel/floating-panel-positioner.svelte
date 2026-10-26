<script lang="ts">
import DialogPositioner from "../dialog/dialog-positioner.svelte"
import type { DialogPositionerProps } from "../dialog/types"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"

/** Placed by `--rind-floating-panel-x/-y/-width/-height`. */
const props: Record<string, unknown> = $props()
const ctx = floatingPanelContext.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  ctx.positioner.current = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  mergeProps({ ...normalizeProps(ctx.api().positioner()), ...el.props }, props),
)
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogPositioner {...merged as DialogPositionerProps} />
