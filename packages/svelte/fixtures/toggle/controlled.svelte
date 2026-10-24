<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, Toggle } from "../../src/index"

// Fully controlled: a function binding whose setter refuses, so only the parent moves it.
const { pressed }: { pressed: boolean } = $props()
</script>

<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
  <Toggle.Root bind:pressed={() => pressed, () => {}}>Bold</Toggle.Root>
</RindProvider>
