<script lang="ts">
import DialogBackdrop from "../dialog/dialog-backdrop.svelte"
import type { DialogBackdropProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useDrawer } from "./context"

// The Dialog's Backdrop with the drawer's extras under the consumer's props.
const props: Record<string, unknown> = $props()
const { extras } = useDrawer()
const merged = $derived(mergeProps(normalizeProps(extras().backdrop()), props))
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogBackdrop {...merged as DialogBackdropProps} />
