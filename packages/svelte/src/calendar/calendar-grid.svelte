<script lang="ts">
import { type CalendarDate, calendarKey, describeKey, isoOf } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import Cell from "./calendar-cell.svelte"
import Body from "./calendar-grid-body.svelte"
import Head from "./calendar-grid-header.svelte"
import HeaderCell from "./calendar-header-cell.svelte"
import Row from "./calendar-row.svelte"
import { calendarGrid, calendarHost } from "./context"
import type { CalendarGridProps } from "./types"

const { month = 0, child, children, ...rest }: CalendarGridProps = $props()
const ctx = calendarHost.get()
const env = useEnvironment()
calendarGrid.set(() => month)
const api = $derived(ctx.api())
// The month and year views have one grid per page: its rows are the page's periods.
const days = $derived(api.view === "days")
const g = $derived(days ? ctx.grid(month) : { weeks: api.periodRows(), month: ctx.grid(0).month })
const handlers = {
  // React's onFocus / onBlur bubble: here, focusin / focusout.
  onfocusin: (e: FocusEvent) => {
    const cell = (e.target as HTMLElement).closest?.('[data-part="cell"]')
    if (!ctx.view().matches("focused"))
      ctx.send({ type: "GRID.FOCUS", modality: env.modality.modality() })
    const iso = cell?.getAttribute("data-value")
    if (!iso) return
    const date = g.weeks.flat().find((d) => isoOf(d) === iso)
    if (date) ctx.send({ type: "CELL.FOCUS", date, modality: env.modality.modality() })
  },
  onfocusout: (e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null
    const inside = next?.closest?.(
      `[data-scope="calendar"][data-part="grid"][data-instance="${CSS.escape(ctx.instance())}"]`,
    )
    if (!inside) ctx.send({ type: "GRID.BLUR" })
  },
  onkeydown: (e: KeyboardEvent) => {
    const event = calendarKey(
      describeKey(e, env),
      api.root()["dir"] === "rtl" ? "rtl" : "ltr",
      env.platform,
      api.view,
    )
    if (!event) return
    e.preventDefault()
    ctx.send(event)
  },
  onpointerleave: () => ctx.send({ type: "GRID.HOVER_END" }),
}
const merged = $derived(
  stripMarker(mergeProps(joinHandlers(normalizeProps(api.grid(month)), handlers), rest)),
)
const state = $derived({ weeks: g.weeks, month: g.month })
</script>

<!-- No whitespace inside the table: React's markup has none. -->
{#snippet content()}{#if children}{@render children(state)}{:else}{#if days}<Head
        ><tr>{#each [0, 1, 2, 3, 4, 5, 6] as i (i)}<HeaderCell day={i} />{/each}</tr></Head
      >{/if}<Body
      >{#each g.weeks as week (isoOf(week[0] as CalendarDate))}<Row
          >{#each week as date (isoOf(date))}<Cell {date} />{/each}</Row
        >{/each}</Body
    >{/if}{/snippet}

{#if days || month === 0}
  {#if child}
    {@render child({ props: { ...merged, children: content }, state: undefined })}
  {:else}
    <table {...attrs(merged)}>{@render content()}</table>
  {/if}
{/if}
