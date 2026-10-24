<script lang="ts">
import RadioGroupItemIndicator from "../radio-group/radio-group-item-indicator.svelte"
import type { RadioGroupItemIndicatorProps } from "../radio-group/types"

// Mounted only while the item is checked: the one selected mark, decorative.
const props: RadioGroupItemIndicatorProps = $props()
</script>

<RadioGroupItemIndicator aria-hidden="true" {...props} />
