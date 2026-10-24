<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Button, type ButtonProps, RindProvider } from "../../src/index"

// `as`: render the Button through a `child` snippet as this element.
const { as, ...props }: ButtonProps & { as?: "div" | "a" } = $props()
</script>

<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
  {#if as === "div"}
    <Button {...props}>
      {#snippet child({ props: p })}<div {...p}>Save</div>{/snippet}
    </Button>
  {:else}
    <Button {...props}>Save</Button>
  {/if}
</RindProvider>
