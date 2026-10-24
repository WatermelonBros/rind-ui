<script lang="ts">
import { type DateClock, platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { DateField, type DateRangeFieldRootProps, RindProvider } from "../../src/index"
import PickerParts from "./picker-parts.svelte"

// The range model's story: the pair under the run's platform and direction.
const {
  root = {},
  picker,
  clock,
}: { root?: Record<string, unknown>; picker?: "closed" | "open"; clock: DateClock } = $props()
const rootProps = $derived({
  selectionMode: "range",
  locale: "en-US",
  startName: "from",
  endName: "to",
  ...root,
  ...(picker === "open" ? { defaultOpen: true } : {}),
} as DateRangeFieldRootProps)
</script>

<!-- The run's platform: the driver's select-all key is the page's (⌘A on Apple, else Ctrl+A). -->
<RindProvider
  environment={{ dateClock: clock, platform: currentRun()?.platform ?? platforms.linux }}
  dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
  ><DateField.Root {...rootProps}
    ><DateField.Label>Stay</DateField.Label>{#if picker}<PickerParts />{:else}<DateField.Input
      />{/if}</DateField.Root
  ></RindProvider
>
