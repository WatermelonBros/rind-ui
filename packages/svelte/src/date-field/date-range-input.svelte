<script lang="ts">
import { focusSafely } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useDateRange } from "./context"
import RangeEnd from "./date-range-end.svelte"
import type { DateFieldEndProps } from "./types"

// The one group of both ends: Start, Separator, End.
const props: DateFieldEndProps = $props()
const range = useDateRange()
if (!range) throw new Error("DateField.Input must be inside DateField.Root")
const ctx = range
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
const firstSegment = () =>
  ctx.inputEl.current?.querySelector<HTMLElement>('[data-edge="start"] input[data-editable]') ??
  null
$effect(() => {
  if (!binding) return
  return untrack(() => {
    const api = ctx.api(binding())
    const id = firstSegment()?.id ?? `${api.ids.input}-first`
    return binding().register(
      {
        id,
        labelable: false,
        focus: (m) => {
          const el = firstSegment()
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => ctx.hidden.start.current,
        value: () => ctx.view().values.value ?? null,
      },
      id,
    )
  })
})
// Each change of the pair's value or validity is reported to the Field once.
let reported = untrack(
  () => `${JSON.stringify(ctx.view().values.value ?? null)}|${ctx.state().message}`,
)
$effect(() => {
  const key = `${JSON.stringify(ctx.view().values.value ?? null)}|${ctx.state().message}`
  untrack(() => {
    if (reported === key) return
    reported = key
    binding?.().report({
      type: "change",
      value: ctx.view().values.value ?? null,
      user: true,
      composing: false,
    })
  })
})
const api = $derived(ctx.api(binding?.() ?? null))
const description = $derived(api.valueDescription())
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.input()), props)))
const ref = (node: HTMLElement) => {
  ctx.inputEl.current = node
  return () => {
    if (ctx.inputEl.current === node) ctx.inputEl.current = null
  }
}
const separator = $derived(api.separator())
const names = $derived([api.edgeName("start"), api.edgeName("end")])
</script>

<div {...attrs(merged)} {@attach ref}
  ><RangeEnd edge="start" /><span {...attrs(normalizeProps(separator))}>{separator["children"] as string}</span
  ><RangeEnd edge="end" />{#each names as n, i (i)}<span {...attrs(normalizeProps(n))}
      >{n["children"] as string}</span
    >{/each}{#if description}<span {...attrs(normalizeProps(description))}
      >{description["children"] as string}</span
    >{/if}</div
>
