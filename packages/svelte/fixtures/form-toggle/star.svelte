<script lang="ts">
import { FormToggle } from "../../src/index"
import { switchConfig } from "../../src/switch/config.svelte"

const { root = {} }: { root?: Record<string, unknown> } = $props()
</script>

<!-- A toggle built from the public parts with Switch's config: the same as Switch. -->
<FormToggle.Root config={switchConfig} {...root}>
  <FormToggle.Control><FormToggle.Indicator /></FormToggle.Control>
  <FormToggle.Label>Notifications</FormToggle.Label>
</FormToggle.Root>
