<script lang="ts">
import { focusSafely, mergeFieldProps, selectIds } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { api, selectHost } from "./context.svelte"
import type { SelectTriggerProps } from "./types"

const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  child,
  children,
  ...rest
}: SelectTriggerProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
$effect.pre(() => {
  ctx.triggerNaming.current = { label: label ?? undefined, labelledBy: labelledBy ?? undefined }
})
const uid = $props.id()
const binding = useFieldControl(uid)
const controlId = untrack(() => selectIds(ctx.instance()).trigger)
$effect(() => {
  if (!binding) return
  return untrack(() =>
    binding().register(
      {
        id: controlId,
        labelable: true,
        focus: (m) => {
          if (ctx.shared.trigger) void focusSafely(ctx.shared.trigger, env, "programmatic", m)
        },
        validityElement: () => ctx.shared.hidden,
        value: () => ctx.service.view().values.value ?? null,
      },
      controlId,
    ),
  )
})
// Each change and each close (a commit) reported to the Field once.
let reported = untrack(() => JSON.stringify(ctx.view().values.value ?? null))
$effect(() => {
  const value = JSON.stringify(ctx.view().values.value ?? null)
  untrack(() => {
    if (reported === value) return
    reported = value
    binding?.().report({ type: "change", value: JSON.parse(value), user: true, composing: false })
  })
})
let wasOpen = untrack(() => ctx.view().matches("open"))
$effect(() => {
  const open = ctx.view().matches("open")
  untrack(() => {
    if (wasOpen && !open) binding?.().report({ type: "commit" })
    wasOpen = open
  })
})
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") api(ctx, env).pressTrigger(e.modality)
  },
  disabled: () => ctx.disabled(),
  // A label's forwarded click focuses the trigger and never opens the popup.
  labelActivation: "focus",
})
const el = elementRef("button")
$effect(() => {
  const node = el.current
  ctx.shared.trigger = node instanceof HTMLElement ? node : null
})
// Development: a trigger needs a name (it is never named by its value). Checked once, a frame
// after mount: the Label registers on mount and the trigger's aria-labelledby follows.
$effect(() => {
  if (!DEV) return
  return untrack(() => {
    const frame = env.scheduler.requestAnimationFrame(() => {
      const node = el.current
      if (!node) return
      const named =
        node.hasAttribute("aria-label") ||
        node.hasAttribute("aria-labelledby") ||
        node.closest("label") !== null ||
        ((node as HTMLButtonElement).labels?.length ?? 0) > 0
      if (!named) {
        console.warn(
          `[rind-ui] select #${node.id}: the trigger has no accessible name; render Select.Label or pass aria-label`,
        )
      }
    })
    return () => env.scheduler.cancelAnimationFrame(frame)
  })
})
const a = $derived(api(ctx, env))
const merged = $derived.by(() => {
  const own = normalizeProps(
    a.trigger({
      tag: el.tag,
      focused,
      modality: modality.current,
      pressed: press.pressed,
      label: label ?? undefined,
      labelledBy: labelledBy ?? undefined,
      describedBy: describedBy ?? undefined,
    }),
  )
  const fieldAria = binding
    ? mergeFieldProps(
        // Sound: the connect writes the trigger's id list as a string (or leaves it out).
        {
          role: "combobox",
          labelable: true,
          describedBy: own["aria-describedby"] as string | undefined,
        },
        binding(),
      )
    : null
  // Space continuing a search must not press the trigger (the trigger's handler acts first).
  const { onkeydown: pressKeyDown, ...pressProps } = press.props as Record<
    string,
    ((e: KeyboardEvent) => void) | undefined
  >
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, pressProps, {
          onkeydown: (e: KeyboardEvent) => {
            if (!e.defaultPrevented) pressKeyDown?.(e)
          },
          onfocus: () => {
            focused = true
          },
          onblur: () => {
            focused = false
          },
        }),
        ...(fieldAria
          ? {
              "aria-describedby": fieldAria["aria-describedby"],
              "aria-required": own["aria-required"] ?? fieldAria["aria-required"],
            }
          : {}),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ open: ctx.view().matches("open"), placeholder: a.placeholder })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
