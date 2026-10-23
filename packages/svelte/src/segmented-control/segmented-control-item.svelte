<script lang="ts">
import { hiddenFormInput, implicitSubmit, isImeKey, toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterItem } from "../use-collection-items.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { segmentedContext } from "./context"
import type { SegmentedControlItemProps } from "./types"

const {
  value,
  disabled = false,
  textValue,
  child,
  children,
  ...rest
}: SegmentedControlItemProps = $props()
const ctx = segmentedContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before focus.
$effect(() => env.modality.subscribe(() => {}))
const key = $derived(toKey(value))
const el = elementRef("button")
useRegisterItem(
  ctx.registry,
  () => ({ key: value, textValue, disabled }),
  () => el.current,
)
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const isDisabled = () => ctx.disabled() || disabled
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
  },
  disabled: isDisabled,
})
const hover = useHover({ env, send: () => {}, disabled: isDisabled })
const inputEl: { current: HTMLInputElement | null } = { current: null }
const checked = $derived(ctx.value() === key)
const formInput = hiddenFormInput(
  { input: () => inputEl.current, control: () => el.current as HTMLElement | null },
  env,
)
// Read once, in document order: this segment's view of the server tab stop.
const pendingStop = untrack(() =>
  ctx.stop(value, isDisabled(), ctx.value() === null ? [] : [ctx.value() as string]),
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
      // The control answers the reset once; each input only re-syncs.
      resetsWithForm: false,
    }),
  ),
)
// Development: a segment needs a name (text content or aria-label).
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  const named =
    (node.textContent ?? "").trim() !== "" ||
    node.getAttribute("aria-label") ||
    node.getAttribute("aria-labelledby")
  if (!named) {
    console.warn(
      `[rind-ui] segmented-control: the item "${value}" has no text and no aria-label; an icon-only segment needs aria-label`,
    )
  }
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api(pendingStop).item(key, {
              tag: el.tag,
              focused,
              modality: modality.current,
              pressed: press.pressed,
              hovered: hover.hovered,
              itemDisabled: disabled,
            }),
          ),
          {
            // Enter submits the form (implicit submission); it never selects.
            onkeydown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              implicitSubmit(inputEl.current?.form ?? null)
            },
          },
          press.props,
          hover.props,
          { onfocusin: () => (focused = true), onfocusout: () => (focused = false) },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ checked, disabled: isDisabled() })
const captureInput = (node: HTMLInputElement) => {
  inputEl.current = node
  return () => {
    if (inputEl.current === node) inputEl.current = null
  }
}
</script>

<!-- The hidden input is a sibling of the segment, never inside it (reka-ui#1597); no
whitespace between them, so inline segments lay out as in the other adapters. -->
{#if child}{@render child({ props: merged, state: current })}{:else}<button
    {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button
  >{/if}<input {...attrs(normalizeProps(ctx.api().hiddenInput(key, { disabled })))} {@attach captureInput} />
