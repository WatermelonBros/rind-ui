<script lang="ts">
import {
  type AlertEvent,
  alertConnect,
  alertMachine,
  alertMessages,
  alertWarnings,
  announceableText,
  announcerCapability,
  type ChangeDetails,
  focusPast,
  observeText,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { presentAtLoad } from "../present-at-load"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { usePresence } from "../use-presence.svelte"
import { alertContext } from "./context"
import type { AlertRootProps } from "./types"

let {
  announce,
  announcement,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  finalFocus,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: AlertRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("alert", alertMessages, () => ownMessages)
const locale = useLocale(() => undefined)
const el = elementRef("div")
const machine = useMachine(
  alertMachine,
  () => ({
    open,
    defaultOpen,
    onOpenChange: (next: boolean, details: ChangeDetails<AlertEvent>) => {
      let cancelled = false
      onOpenChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && open !== undefined) open = next
    },
    announce,
    announcement,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
    moveFocusOut: () => {
      if (el.current instanceof HTMLElement) focusPast(el.current, finalFocus?.(), env, "alert")
    },
  }),
  env,
)
const send = machine.send
const isOpen = $derived(machine.view.state === "open")
const presence = usePresence(
  () => isOpen,
  () => el.current,
)
// A hydrated alert was present at load and stays silent.
const hydrating = untrack(() => presentAtLoad("alert", "root", instance))
const text = () => (el.current instanceof HTMLElement ? announceableText(el.current) : [])
$effect(() => untrack(() => send({ type: "ROOT.MOUNT", hydrating, segments: text() })))
// Shown again (`open` became true): the text read from what was rendered.
let wasOpen = untrack(() => isOpen)
$effect(() => {
  const now = isOpen
  untrack(() => {
    if (now && !wasOpen) send({ type: "ROOT.SHOW", segments: text() })
    wasOpen = now
  })
})
// Every change of the rendered text while the element is mounted.
$effect(() => {
  const node = el.current
  if (!presence.mounted || (announce ?? "polite") === "off" || !(node instanceof HTMLElement))
    return
  return observeText(node, (segments) => send({ type: "CONTENT.CHANGE", segments }))
})
$effect(() => {
  void JSON.stringify([rest.role, rest["aria-live"], rest["aria-atomic"]])
  untrack(() => alertWarnings(rest as Readonly<Record<string, unknown>>))
})
const connect = $derived(alertConnect({ instance, open: isOpen, dismissLabel: messages().dismiss }))
alertContext.set({ connect: () => connect, open: () => isOpen, root: () => el.current, send })
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(connect.root()), ...(id === undefined ? {} : { id }), ...el.props },
      rest,
    ),
  ),
)
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: { open: isOpen } })}
  {:else}
    <div {...attrs(merged)}>{@render children?.({ open: isOpen })}</div>
  {/if}
{/if}
