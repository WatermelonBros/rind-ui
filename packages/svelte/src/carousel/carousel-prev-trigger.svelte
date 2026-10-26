<script lang="ts">
import Trigger from "./carousel-trigger.svelte"
import type { CarouselButtonProps } from "./types"

/** The previous page. */
const triggerProps: CarouselButtonProps = $props()
</script>

<Trigger kind="prevTrigger" {...triggerProps} />
