<script lang="ts">
import {
  type DateFieldBoundary,
  type DateValidityFlags,
  type FieldValue,
  focusSafely,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useDateRange } from "./context"
import SingleInput from "./date-field-single-input.svelte"
import SingleRoot from "./date-field-single-root.svelte"
import type { DateFieldChangeDetails, DateFieldEndProps } from "./types"

// One end of a range: an embedded field named by the end and the Label.
const { edge, ...rest }: DateFieldEndProps & { edge: "start" | "end" } = $props()
const range = useDateRange()
if (!range) throw new Error("DateField.Start / End must be inside a range DateField.Root")
const ctx = range
// The group registers with the Field; an end only reads its label's id.
const binding = useFieldBindingPeek()
const env = useEnvironment()
const EDGE = $derived(edge === "start" ? "START" : "END")
const api = $derived(ctx.api(binding?.() ?? null))
const value = $derived(
  (edge === "start"
    ? ctx.view().context.startValue
    : ctx.view().context.endValue) as FieldValue | null,
)
const editable = (which: "start" | "end") =>
  Array.from(
    ctx.inputEl.current?.querySelectorAll<HTMLElement>(
      `[data-edge="${which}"] input[data-editable]`,
    ) ?? [],
  )
const labelledBy = $derived(
  [edge === "start" ? api.ids.startName : api.ids.endName, binding?.().ids.label].filter(
    (x): x is string => x !== undefined,
  ),
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.edge(edge)), rest)))
// The Svelte Field's prop is `readonly`.
const end = $derived.by(() => {
  const { readOnly, ...e } = ctx.end()
  return { ...e, readonly: readOnly }
})
const onBoundary = (b: DateFieldBoundary) => {
  // Focus between ends (spec "Range Mode — Focus Between Ends").
  const target =
    edge === "start" && b.direction === "next" && b.reason === "advance"
      ? editable("end")[0]
      : edge === "end" && b.direction === "previous" && b.reason === "backspace"
        ? editable("start").at(-1)
        : undefined
  if (target) void focusSafely(target, env, "programmatic", "keyboard")
}
</script>

<div {...attrs(merged)}
  ><SingleRoot
    {...end as Record<string, unknown>}
    embedded
    {value}
    onValueChange={(v: FieldValue | null, details: DateFieldChangeDetails) =>
      ctx.send({ type: `${EDGE}.COMMIT` as "START.COMMIT", value: v, reason: details.reason })}
    onClearAll={() => ctx.send({ type: "CLEAR" })}
    onValidityChange={(flags: DateValidityFlags, message: string) =>
      ctx.send({ type: `${EDGE}.VALIDITY` as "START.VALIDITY", flags, message })}
    {labelledBy}
    invalid={api.invalid}
    describedBy={api.endDescribedBy(edge)}
    segmentScope={() => ctx.inputEl.current}
    {onBoundary}><SingleInput /></SingleRoot
  ></div
>
