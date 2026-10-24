<script lang="ts">
import Input from "../../src/color-field/color-field-input.svelte"
import Root from "../../src/color-field/color-field-root.svelte"
import Label from "../../src/field/host-label.svelte"
import Provider from "./provider.svelte"

const { defaultValue, alpha }: { defaultValue: string; alpha: boolean } = $props()
</script>

<Provider
  ><form
    ><Root name="fill" {defaultValue} {alpha}><Label>Fill</Label><Input /></Root><button type="reset"
      >Reset</button
    ></form
  ></Provider
>
