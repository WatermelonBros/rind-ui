<script lang="ts">
import type { DateClock } from "@rind-ui/core"
import { Calendar, DateField, type DateFieldRootProps, RindProvider } from "../../src/index"

// The parity example: the field, its Description and, for a picker, the Control and popover.
// No whitespace between parts: React's markup has none.
const {
  root = {},
  picker = false,
  clock,
}: { root?: Record<string, unknown>; picker?: boolean; clock: DateClock } = $props()
const rootProps = $derived({
  id: "date",
  locale: "en-US",
  ...root,
} as unknown as DateFieldRootProps)
</script>

<RindProvider environment={{ dateClock: clock }}
  ><DateField.Root {...rootProps}
    ><DateField.Label>Birthday</DateField.Label>{#if picker}<DateField.Control
        ><DateField.Input /><DateField.Trigger>▾</DateField.Trigger><DateField.ClearTrigger
          >×</DateField.ClearTrigger
        ></DateField.Control
      >{:else}<DateField.Input />{/if}<DateField.Description>When you were born.</DateField.Description
    >{#if picker}<DateField.Portal
        ><DateField.Positioner
          ><DateField.Content
            ><DateField.Calendar
              ><Calendar.Header
                ><Calendar.PrevTrigger /><Calendar.Heading /><Calendar.NextTrigger /></Calendar.Header
              ><Calendar.Grid /></DateField.Calendar
            ></DateField.Content
          ></DateField.Positioner
        ></DateField.Portal
      >{/if}</DateField.Root
  ></RindProvider
>
