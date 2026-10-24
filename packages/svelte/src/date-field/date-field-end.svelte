<script lang="ts">
import RangeEnd from "./date-range-end.svelte"
import type { DateFieldEndProps } from "./types"

const props: DateFieldEndProps = $props()
</script>

<RangeEnd edge="end" {...props} />
