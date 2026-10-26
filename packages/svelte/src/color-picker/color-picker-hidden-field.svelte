<script lang="ts">
import { watchFieldsetDisabled } from "@rind-ui/core"
import { untrack } from "svelte"
import { attrs, normalizeProps } from "../normalize-props"
import { colorPicker } from "./context"

// The hidden input: the value property mirrors the colour after every commit; a reset restores
// the default; a native change we did not make (autofill) is adopted.
const ctx = colorPicker.get()
let el: HTMLInputElement | null = null
$effect(() => {
  const v = ctx.formValue()
  untrack(() => {
    if (el && el.value !== v) el.value = v
  })
})
const ref = (input: HTMLInputElement) => {
  el = input
  if (input.value !== ctx.formValue()) input.value = ctx.formValue()
  const owner = input.form
  const onReset = () => ctx.send({ type: "RESET" })
  const onChange = (e: Event) => {
    if (e.isTrusted) ctx.send({ type: "ADOPT", text: (e.target as HTMLInputElement).value })
  }
  owner?.addEventListener("reset", onReset)
  input.addEventListener("change", onChange)
  const fieldset = watchFieldsetDisabled(input, ctx.setFieldsetDom)
  ctx.setFieldsetDom(fieldset.disabled)
  return () => {
    fieldset.stop()
    owner?.removeEventListener("reset", onReset)
    input.removeEventListener("change", onChange)
    el = null
  }
}
</script>

<input {...attrs(normalizeProps(ctx.api().hiddenInput()))} {@attach ref} />
