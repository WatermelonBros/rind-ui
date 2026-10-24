<script lang="ts">
import DialogContent from "../dialog/dialog-content.svelte"
import type { DialogContentProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useDrawer } from "./context"

// The Dialog's Content with the drawer's extras under the consumer's props.
const props: Record<string, unknown> = $props()
const { extras } = useDrawer()
const merged = $derived(mergeProps(normalizeProps(extras().content()), props))
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogContent {...merged as DialogContentProps} />
