<script lang="ts">
import { type DateClock, platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { DateField, type DateFieldRootProps, Field, RindProvider } from "../../src/index"
import PickerParts from "./picker-parts.svelte"

// The model's story: the field in a form (Reset button), under the run's platform and direction.
const {
  cfg = {},
  clock,
  onValueChange,
}: { cfg?: Record<string, unknown>; clock: DateClock; onValueChange?: () => void } = $props()
const { inField, platform, picker, readOnly, ...root } = $derived(cfg)
const rootProps = $derived({
  name: "date",
  ...root,
  ...(readOnly === undefined ? {} : { readonly: readOnly }),
  ...(onValueChange ? { onValueChange } : {}),
  ...(picker === "open" ? { defaultOpen: true } : {}),
} as unknown as DateFieldRootProps)
</script>

{#snippet field()}<DateField.Root {...rootProps}
    >{#if !inField}<DateField.Label>Birthday</DateField.Label>{/if}{#if picker}<PickerParts
      />{:else}<DateField.Input />{/if}</DateField.Root
  >{/snippet}

<RindProvider
  environment={{
    platform: (platform as typeof platforms.linux | undefined) ?? currentRun()?.platform ?? platforms.linux,
    dateClock: clock,
  }}
  dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
  ><form
    onsubmit={(e) => {
      e.preventDefault()
    }}
    >{#if inField}<Field.Root validationMode="change"
        ><Field.Label>Birthday</Field.Label>{@render field()}<Field.ErrorMessage /></Field.Root
      >{:else}{@render field()}{/if}<button type="reset">Reset</button></form
  ></RindProvider
>
