<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import type { Snippet } from "svelte"
import { RindProvider } from "../../src/index"

// The run's platform and direction.
const { children }: { children: Snippet } = $props()
</script>

<RindProvider
  dir={currentRun()?.direction ?? "ltr"}
  environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render children()}</RindProvider
>
