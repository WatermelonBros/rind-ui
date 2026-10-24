<script lang="ts">
import {
  announcerCapability,
  type ClipboardCopyDetails,
  clipboardCapability,
  clipboardConnect,
  clipboardMachine,
  clipboardMessages,
  partId,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { clipboardContext } from "./context.svelte"
import type { ClipboardRenderState, ClipboardRootProps } from "./types"

const {
  value,
  copyFeedbackDuration,
  disabled = false,
  onCopy,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: ClipboardRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability, clipboardCapability)
const messages = useMessages("clipboard", clipboardMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const registry = usePartRegistry<"label" | "input">(
  untrack(() => ({ scope: "clipboard", root: instance })),
)
const copyAnchor: { current: HTMLElement | null } = { current: null }
const machine = useMachine(
  clipboardMachine,
  () => ({
    value,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
    copyFeedbackDuration,
    disabled,
    onCopy: (d: ClipboardCopyDetails) => onCopy?.(d),
    getCopyAnchor: () => copyAnchor.current,
  }),
  env,
)
const ids = $derived({
  label: partId("clipboard", instance, "label"),
  input: partId("clipboard", instance, "input"),
  trigger: partId("clipboard", instance, "trigger"),
})
const labelId = useRenderedId(registry, "label")
const inputId = useRenderedId(registry, "input")
const clipState: ClipboardRenderState = $derived({ copyState: machine.view.state, value })
const api = $derived(
  clipboardConnect(
    {
      instance,
      state: machine.view.state,
      value,
      disabled,
      messages: messages(),
      ids: {
        label: labelId.current ?? ids.label,
        input: inputId.current ?? ids.input,
        trigger: ids.trigger,
      },
      rendered: { label: labelId.current !== undefined, input: inputId.current !== undefined },
    },
    env,
  ),
)
clipboardContext.set({
  api: () => api,
  send: machine.send,
  state: () => clipState,
  copyAnchor,
  registry,
  ids: () => ids,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: clipState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(clipState)}</div>
{/if}
