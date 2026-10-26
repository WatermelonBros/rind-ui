<script lang="ts">
import Trigger from "./editable-trigger.svelte"
import type { EditableButtonProps } from "./types"

const triggerProps: EditableButtonProps = $props()
</script>

<Trigger kind="submitTrigger" {...triggerProps} />
