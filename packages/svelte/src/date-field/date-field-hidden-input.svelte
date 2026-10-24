<script lang="ts">
import { formValueOf } from "@rind-ui/core"
import { untrack } from "svelte"
import { attrs, normalizeProps } from "../normalize-props"
import { useApi, useDateField } from "./context"

// The hidden native input: name, ISO value, constraints, validity, reset, autofill.
const ctx = useDateField("Root")
const api = useApi(ctx)
const mirror = () => ({
  value: formValueOf(ctx.view().values.value ?? null, ctx.base().granularity),
})
$effect(() => {
  void mirror().value
  untrack(() => ctx.formInput.sync(mirror(), { dispatch: false }))
})
$effect(() =>
  untrack(() =>
    ctx.formInput.track({
      onReset: () => ctx.send({ type: "RESET" }),
      current: mirror,
      onNativeInput: (input) => {
        ctx.send({ type: "INPUT.ADOPT", value: input.value })
        return true
      },
    }),
  ),
)
const ref = (node: HTMLInputElement) => {
  ctx.hiddenEl.current = node
  return () => {
    if (ctx.hiddenEl.current === node) ctx.hiddenEl.current = null
  }
}
</script>

<input {...attrs(normalizeProps(api().hiddenInput()))} {@attach ref} />
