<script lang="ts">
import { Toggle } from "../../src/index"

let {
  pressed = $bindable(false),
  veto = false,
  record,
}: {
  pressed?: boolean
  veto?: boolean
  record: (pressed: boolean) => void
} = $props()
</script>

<Toggle.Root
  bind:pressed
  data-variant="outline"
  onPressedChange={(v, d) => {
    record(v)
    if (veto) d.cancel()
  }}
>
  {#snippet child({ props })}
    <a href="#top" class="mine" {...props}>
      Bold
      <Toggle.Indicator>
        on
        {#snippet fallback()}off{/snippet}
      </Toggle.Indicator>
    </a>
  {/snippet}
</Toggle.Root>
