<script lang="ts">
import Trigger from "./code-block-trigger.svelte"
import type { CodeBlockTriggerProps } from "./types"

const props: CodeBlockTriggerProps = $props()
</script>

<Trigger {...props} kind="copyTrigger" />
