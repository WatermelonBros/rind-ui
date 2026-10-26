<script lang="ts">
import DialogContent from "../dialog/dialog-content.svelte"
import type { DialogContentProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"

/** The non-modal dialog, named by the Title (the Dialog owns its role and references). */
const props: Record<string, unknown> = $props()
const ctx = floatingPanelContext.get()
const merged = $derived.by(() => {
  const {
    role: _role,
    "aria-labelledby": _l,
    "aria-describedby": _d,
    tabindex: _t,
    id: _id,
    ...own
  } = normalizeProps(ctx.api().content())
  return mergeProps(own, props)
})
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogContent {...merged as DialogContentProps} />
