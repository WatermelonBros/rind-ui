<script lang="ts">
import { colorFieldFormValue } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { attrs, normalizeProps } from "../normalize-props"
import { colorField } from "./context"

// The hidden input: name, `required`, validity, reset, autofill.
const ctx = colorField.get()
const mirror = () => ({ value: colorFieldFormValue(ctx.value()) })
$effect(() => {
  const s = ctx.state()
  void mirror().value
  untrack(() => {
    ctx.formInput.sync(mirror(), { dispatch: false })
    // A committed text that is not a colour makes the field invalid (the Field's badInput).
    ctx.hiddenEl.current?.setCustomValidity(s.dirty && s.invalid ? ctx.invalidMessage() : "")
  })
})
$effect(() =>
  untrack(() =>
    ctx.formInput.track({
      onReset: () => ctx.send({ type: "RESET" }),
      current: mirror,
      onNativeInput: (input) => {
        ctx.send({ type: "ADOPT", text: input.value })
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

<input {...attrs(normalizeProps(ctx.api().hiddenInput()))} {@attach ref} />
