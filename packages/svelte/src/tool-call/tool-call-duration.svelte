<script lang="ts">
import Impl from "./tool-call-part.svelte"
import type { ToolCallPartProps } from "./types"

const partProps: ToolCallPartProps = $props()
</script>

<Impl kind="duration" {...partProps} />
