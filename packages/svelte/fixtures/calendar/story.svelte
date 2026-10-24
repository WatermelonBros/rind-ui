<script lang="ts">
import { type DateClock, platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Calendar, type CalendarRootProps, RindProvider } from "../../src/index"

// The Calendar under the run's platform and direction, with a fixed clock. No whitespace
// between parts: React's markup has none.
const {
  cfg = {},
  clock,
  model = true,
}: { cfg?: Record<string, unknown>; clock: DateClock; model?: boolean } = $props()
const root = $derived({
  "aria-label": "Departure",
  ...(model ? { firstDayOfWeek: "sun" } : {}),
  ...cfg,
} as CalendarRootProps)
const months = $derived((cfg["visibleMonths"] as number | undefined) ?? 1)
</script>

<RindProvider
  environment={model
    ? { platform: currentRun()?.platform ?? platforms.linux, dateClock: clock }
    : { dateClock: clock }}
  dir={model ? (currentRun()?.direction === "rtl" ? "rtl" : "ltr") : undefined}
  ><Calendar.Root {...root}
    ><Calendar.Header><Calendar.PrevTrigger /><Calendar.Heading /><Calendar.NextTrigger /></Calendar.Header
    >{#each Array.from({ length: months }, (_, m) => m) as m (m)}<Calendar.Grid month={m} />{/each}</Calendar.Root
  ></RindProvider
>
