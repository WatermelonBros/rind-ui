<script lang="ts">
import {
  type ChangeDetails,
  type EditableEvent,
  type EditableState,
  editableConnect,
  editableMachine,
  editableMessages,
  focusSafely,
  hiddenFormInput,
  partId,
  watchLeave,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { editableContext } from "./context"
import type { EditableRenderState, EditableRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  edit = $bindable(),
  defaultEdit,
  onEditChange,
  onDraftChange,
  activationMode = "click",
  submitMode,
  selectOnFocus = true,
  placeholder,
  maxLength,
  disabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: EditableRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const messages = useMessages("editable", editableMessages, () => ownMessages)
const registry = usePartRegistry<"label">(untrack(() => ({ scope: "editable", root: instance })))
const ownLabel = useRenderedId(registry, "label")
const ids = $derived({
  label: partId("editable", instance, "label"),
  preview: partId("editable", instance, "preview"),
  input: partId("editable", instance, "input"),
  hidden: partId("editable", instance, "hidden-input"),
})
const inputEl: { current: HTMLElement | null } = { current: null }
const previewEl: { current: HTMLElement | null } = { current: null }
const hiddenEl: { current: HTMLInputElement | null } = { current: null }
let rootEl: HTMLElement | undefined = $state()
const formInput = hiddenFormInput({ input: () => hiddenEl.current }, env)
// After the update that shows the Input (or the Preview): the element is not hidden yet now.
const later = (fn: () => void) => env.scheduler.requestAnimationFrame(fn)
const machine = useMachine(editableMachine, () => ({
  value,
  defaultValue,
  onValueChange: (v: string, d: ChangeDetails<EditableEvent>) => {
    onValueChange?.(v, d)
    if (value !== undefined) value = v
  },
  edit,
  defaultEdit,
  onEditChange: (e: boolean, d: ChangeDetails<EditableEvent>) => {
    onEditChange?.(e, d)
    if (edit !== undefined) edit = e
  },
  onDraftChange: (d: string) => onDraftChange?.(d),
  activationMode,
  submitMode,
  disabled,
  readOnly,
  focusInput: () => {
    const entry = current
    later(() => {
      const el = inputEl.current
      if (!el) return
      void focusSafely(el, env, "programmatic", env.modality.modality())
      // Keys typed in the frame before (Enter on EditTrigger, then typing) are kept.
      const fresh =
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value === entry
      if (selectOnFocus && fresh) el.select()
    })
  },
  focusPreview: () =>
    later(() => {
      if (previewEl.current)
        void focusSafely(previewEl.current, env, "programmatic", env.modality.modality())
    }),
}))
const current = $derived(machine.view.values.value ?? "")
const api = $derived(
  editableConnect(
    {
      instance,
      state: machine.view.state as EditableState,
      value: current,
      draft: machine.view.context.draft,
      placeholder,
      disabled,
      readOnly,
      required,
      invalid,
      name,
      maxLength,
      messages: messages(),
      ids: { ...ids, label: ownLabel.current ?? ids.label },
      rendered: { label: ownLabel.current !== undefined },
    },
    env,
  ),
)
// The hidden input mirrors the committed value after every update; a form reset restores it.
$effect(() => {
  const now = current
  untrack(() => formInput.sync({ value: now }, { dispatch: false }))
})
$effect(() =>
  untrack(() =>
    formInput.track({
      onReset: () => machine.send({ type: "RESET" }),
      current: () => ({ value: current }),
    }),
  ),
)
// While editing, a press or focus outside the Root (Area, Control, triggers) is OUTSIDE.
$effect(() => {
  const el = rootEl
  if (!api.editing || !el) return
  return untrack(() => watchLeave(el, () => machine.send({ type: "OUTSIDE" })))
})
const editState: EditableRenderState = $derived({
  state: machine.view.state as EditableState,
  editing: api.editing,
  value: current,
  draft: machine.view.context.draft,
})
editableContext.set({
  api: () => api,
  send: machine.send,
  state: () => editState,
  activationMode: () => activationMode,
  registry,
  labelId: () => ids.label,
  inputEl,
  previewEl,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
// The value is written as a property by hiddenFormInput; a reset re-syncs it.
const hidden = $derived.by(() => {
  const { value: _value, ...h } = normalizeProps(api.hiddenInput())
  return { ...h, ...(form === undefined ? {} : { form }) }
})
const captureRoot = (node: HTMLElement) => {
  rootEl = node
  return () => {
    if (rootEl === node) rootEl = undefined
  }
}
const captureHidden = (node: HTMLInputElement) => {
  hiddenEl.current = node
  return () => {
    if (hiddenEl.current === node) hiddenEl.current = null
  }
}
</script>

{#snippet hiddenInput()}<input {...attrs(hidden)} {@attach captureHidden} />{/snippet}

{#if child}
  {@render child({ props: merged, state: editState })}{@render hiddenInput()}
{:else}
  <div {...attrs(merged)} {@attach captureRoot}>{@render children?.(editState)}{@render hiddenInput()}</div>
{/if}
