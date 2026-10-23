<script lang="ts">
import Trigger from "./pagination-trigger.svelte"
import type { PaginationControlProps } from "./types"

const props: PaginationControlProps = $props()
</script>

<Trigger {...props} direction="next" />
