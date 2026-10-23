<script lang="ts">
import Trigger from "./number-input-trigger.svelte"
import type { NumberInputTriggerProps } from "./types"

const props: NumberInputTriggerProps = $props()
</script>

<Trigger {...props} trigger="decrement" />
