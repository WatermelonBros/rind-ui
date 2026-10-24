<script lang="ts">
import NumberInputInput from "../number-input/number-input-input.svelte"
import type { NumberInputInputProps } from "../number-input/types"
import { colorChannel } from "./context"

// Named by the channel when there is no Label (a Label's `aria-labelledby` wins).
const props: NumberInputInputProps = $props()
const channelName = colorChannel.maybe() ?? (() => "")
</script>

<NumberInputInput aria-label={channelName()} {...props} />
