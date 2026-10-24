<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useHover, usePress } from "../use-press.svelte"
import { calendarGrid, calendarHost } from "./context"
import type { CalendarCellProps } from "./types"

const { date, child, children, ...rest }: CalendarCellProps = $props()
const ctx = calendarHost.get()
const env = useEnvironment()
const month = calendarGrid.maybe() ?? (() => 0)
const own = $derived(ctx.api().cell(date, month()))
const placeholder = $derived(own["data-outside-month"] !== undefined)
const disabled = $derived(own["data-disabled"] !== undefined)
const press = usePress({
  env,
  disabled: () => placeholder || disabled,
  send: (e) => {
    // A placeholder never selects (react-spectrum#3257); release, not press, selects.
    // Enter and Space are the grid's keys (SELECT_FOCUSED): a key press here would select
    // twice (a multiple selection toggles back).
    // A press that dragged was handled by the drag (its release is not a second click).
    if (
      e.type === "PRESS" &&
      e.pointerType !== "keyboard" &&
      !placeholder &&
      !disabled &&
      !ctx.dragConsumes(e)
    ) {
      ctx.send({ type: "CELL.PRESS", date, modality: e.modality })
    }
  },
})
const hover = useHover({
  env,
  disabled: () => disabled,
  send: (e) => {
    if (e.type === "HOVER.START") ctx.send({ type: "CELL.HOVER", date })
  },
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(own), press.props, hover.props),
        "data-pressed": press.pressed ? "" : undefined,
      },
      rest,
    ),
  ),
)
const current = $derived({ date, selected: own["data-selected"] !== undefined })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- The cell's text is connect's `children` (normalizeProps leaves content out). -->
  <td {...attrs(merged)}>{#if children}{@render children(current)}{:else}{own["children"] as string}{/if}</td>
{/if}
