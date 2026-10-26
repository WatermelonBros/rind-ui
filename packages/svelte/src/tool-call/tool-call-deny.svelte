<script lang="ts">
import Impl from "./tool-call-button.svelte"
import type { ToolCallButtonProps } from "./types"

const partProps: ToolCallButtonProps = $props()
</script>

<Impl kind="deny" {...partProps} />
