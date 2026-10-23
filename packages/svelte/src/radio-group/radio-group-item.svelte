<script lang="ts">
import { hiddenFormInput, toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterItem } from "../use-collection-items.svelte"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemProps } from "./types"

const {
  value,
  disabled = false,
  textValue,
  child,
  children,
  ...rest
}: RadioGroupItemProps = $props()
const ctx = radioGroupContext.get()
const env = useEnvironment()
const key = $derived(toKey(value))
const el = elementRef("div")
useRegisterItem(
  ctx.registry,
  () => ({ key: value, textValue, disabled }),
  () => el.current,
)
let controlTag = $state("button")
let labelRendered = $state(false)
let descriptionRendered = $state(false)
const inputEl: { current: HTMLInputElement | null } = { current: null }
const controlEl: { current: Element | null } = { current: null }
const checked = $derived(ctx.value() === key)
const formInput = hiddenFormInput(
  { input: () => inputEl.current, control: () => controlEl.current as HTMLElement | null },
  env,
)
// After every update: the input mirrors the value; the newly checked one, after a user
// change, dispatches input + change (programmatic changes stay silent).
$effect(() => {
  const now = checked
  untrack(() => {
    const dispatch = now && ctx.pending.current === key
    formInput.sync({ checked: now }, { dispatch })
    if (dispatch) ctx.pending.current = null
  })
})
$effect(() =>
  untrack(() =>
    formInput.track({
      onReset: () => {},
      current: () => ({ checked }),
      // The group answers the reset once; each input only re-syncs.
      resetsWithForm: false,
    }),
  ),
)
radioItemContext.set({
  key: () => key,
  disabled: () => disabled,
  controlTag: () => controlTag,
  setControlTag: (tag) => {
    controlTag = tag
  },
  labelRendered: () => labelRendered,
  setLabelRendered: (on) => {
    labelRendered = on
  },
  descriptionRendered: () => descriptionRendered,
  setDescriptionRendered: (on) => {
    descriptionRendered = on
  },
  inputEl,
  controlEl,
  pendingStop: untrack(() =>
    ctx.stop(
      value,
      ctx.disabled() || disabled,
      ctx.value() === null ? [] : [ctx.value() as string],
    ),
  ),
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(ctx.api().item(key, { disabled })), ...el.props }, rest),
  ),
)
const current = $derived({ checked, disabled: ctx.disabled() || disabled })
const captureInput = (node: HTMLInputElement) => {
  inputEl.current = node
  return () => {
    if (inputEl.current === node) inputEl.current = null
  }
}
</script>

<!-- A sibling of the control, never inside it (reka-ui#1597); no whitespace around it. -->
{#snippet input()}<input {...attrs(normalizeProps(ctx.api().hiddenInput(key, { disabled })))} {@attach captureInput} />{/snippet}

{#if child}
  {@render child({ props: merged, state: current })}
  {@render input()}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}{@render input()}</div>
{/if}
