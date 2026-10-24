<script lang="ts">
import { mergeFieldProps } from "@rind-ui/core"
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import { attrs, normalizeProps } from "../normalize-props"
import { useApi } from "./api.svelte"
import { numberInputContext } from "./context"

/** The hidden `<input type="number">`: name, constraints, validity, reset, autofill. */
const ctx = numberInputContext.get()
const binding = useFieldBindingPeek()
const apiFor = useApi(ctx, binding)
const mirror = () => {
  const v = ctx.view().values.value ?? null
  return { value: v === null ? "" : String(v) }
}
// After every update: the input shows the value (hydration, a parent's change); no events.
$effect(() => {
  const m = mirror()
  untrack(() => ctx.formInput.sync(m, { dispatch: false }))
})
$effect(() =>
  untrack(() =>
    ctx.formInput.track({
      onReset: () => ctx.send({ type: "RESET" }),
      current: mirror,
      onNativeInput: (input) => {
        const n = input.value === "" ? null : Number(input.value)
        ctx.send({ type: "INPUT.ADOPT", value: n !== null && Number.isFinite(n) ? n : null })
        return true
      },
    }),
  ),
)
const props = $derived.by(() => {
  const b = binding?.() ?? null
  const field = mergeFieldProps(
    {
      role: "spinbutton",
      labelable: true,
      disabled: ctx.disabled(),
      readOnly: ctx.readOnly(),
      ...(b?.name === undefined ? {} : { name: b.name }),
    },
    b,
  )
  return normalizeProps({
    ...apiFor().hiddenInput(),
    name: field.name,
    required: field.required || undefined,
  })
})
const capture = (node: HTMLInputElement) => {
  ctx.hiddenEl.current = node
  return () => {
    if (ctx.hiddenEl.current === node) ctx.hiddenEl.current = null
  }
}
</script>

<input {...attrs(props)} {@attach capture} />
