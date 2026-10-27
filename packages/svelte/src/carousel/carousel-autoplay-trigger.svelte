<script lang="ts">
import Trigger from "./carousel-trigger.svelte"
import type { CarouselButtonProps } from "./types"

/** Stops and starts autoplay; named by what it does. */
const triggerProps: CarouselButtonProps = $props()
</script>

<Trigger kind="autoplayTrigger" {...triggerProps} />
