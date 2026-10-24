<script lang="ts">
import { focusSafely } from "@rind-ui/core"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { useFieldControl } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import PopoverTrigger from "../popover/popover-trigger.svelte"
import { useEnvironment } from "../provider"
import { colorPicker, inTrigger } from "./context"
import type { ColorPickerButtonProps } from "./types"

// Opens the content; named "Choose color, <colour>" and by the Label.
const { child, children, ...rest }: ColorPickerButtonProps = $props()
const ctx = colorPicker.get()
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
inTrigger.set(true)
const triggerId = $derived(ctx.api().trigger()["aria-labelledby"]?.toString().split(" ")[0] ?? "")
$effect(() => {
  const id = triggerId
  if (!binding || !id) return
  return untrack(() =>
    binding().register(
      {
        id,
        labelable: true,
        focus: (m) => {
          if (ctx.triggerEl.current) void focusSafely(ctx.triggerEl.current, env, "programmatic", m)
        },
        validityElement: () => null,
        value: () => ctx.formValue(),
      },
      id,
    ),
  )
})
$effect(() => {
  if (ctx.inline && DEV)
    console.warn("[rind-ui] color-picker: an inline picker has no Trigger; it renders nothing")
})
const ref = (el: HTMLElement) => {
  ctx.triggerEl.current = el
  return () => {
    if (ctx.triggerEl.current === el) ctx.triggerEl.current = null
  }
}
const merged = $derived(
  mergeProps(normalizeProps(ctx.api().trigger()), rest as Record<string, unknown>),
)
</script>

{#if !ctx.inline}
  <PopoverTrigger {...merged} {@attach ref} child={child as never}
    >{@render children?.(ctx.state())}</PopoverTrigger
  >
{/if}
