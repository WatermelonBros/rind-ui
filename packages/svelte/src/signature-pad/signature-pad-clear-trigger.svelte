<script lang="ts">
import Trigger from "./signature-pad-trigger.svelte"
import type { SignaturePadTriggerProps } from "./types"

const props$: SignaturePadTriggerProps = $props()
</script>

<Trigger kind="clear" {...props$} />
