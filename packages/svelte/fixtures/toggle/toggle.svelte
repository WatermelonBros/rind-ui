<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, Toggle } from "../../src/index"

const { defaultPressed = undefined }: { defaultPressed?: boolean } = $props()
</script>

<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
  <Toggle.Root {defaultPressed}>Bold</Toggle.Root>
</RindProvider>
