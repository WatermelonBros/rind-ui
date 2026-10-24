<script lang="ts">
import DialogPositioner from "../dialog/dialog-positioner.svelte"
import type { DialogPositionerProps } from "../dialog/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useDrawer } from "./context"

// The Dialog's Positioner with the drawer's extras under the consumer's props.
const props: Record<string, unknown> = $props()
const { extras } = useDrawer()
const merged = $derived(mergeProps(normalizeProps(extras().positioner()), props))
</script>

<!-- Sound: merged holds the part's own attributes and handlers, plus the consumer's. -->
<DialogPositioner {...merged as DialogPositionerProps} />
