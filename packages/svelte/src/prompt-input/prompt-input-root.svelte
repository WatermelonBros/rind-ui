<script lang="ts">
// Prompt Input (prompt-input spec): Root owns the machine and renders the form, a Field
// (standalone, or joined to an enclosing one), the hidden file inputs and the attachments
// summary; every other part is wiring. Derived state and keys live in core's connect.
import {
  announcerCapability,
  type FileRejection,
  type PromptAttachment,
  type PromptInputState,
  type PromptMessage,
  type PromptSubmitDetails,
  type PromptValueReason,
  promptAttachmentsReason,
  promptInputConnect,
  promptInputIds,
  promptInputMachine,
  promptInputMessages,
  promptValueReason,
  replaceText,
  syncFileInput,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { type CountState, promptInput } from "./context"
import type { PromptInputControl, PromptInputRootProps } from "./types"

let {
  id,
  child,
  children,
  value = $bindable(),
  defaultValue = "",
  onValueChange,
  attachments: ownAttachments = $bindable(),
  defaultAttachments,
  onAttachmentsChange,
  onSubmit,
  status,
  onStop,
  onReject,
  submitKey = "enter",
  history,
  accept,
  multiple = true,
  maxFiles,
  maxFileSize,
  name = "message",
  filesName = "files",
  disabled: ownDisabled = false,
  readOnly: ownReadOnly = false,
  invalid,
  errors,
  messages: overrides,
  fieldMessages,
  ...form
}: PromptInputRootProps = $props()
const EMPTY: readonly PromptAttachment[] = []
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const ids = $derived(promptInputIds(instance))
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  ownDisabled || enclosing?.().state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(ownReadOnly || enclosing?.().state.readOnly === true)
const messages = $derived({ ...promptInputMessages, ...overrides })
const controlled = $derived(value !== undefined)
let countState = $state<CountState | null>(null)
let textareaId = $state(untrack(() => ids.textarea))
let focusedButton = $state<"submit" | "attach-trigger" | null>(null)
const textarea: { current: HTMLTextAreaElement | null } = { current: null }
const mounted = { textareas: 0, submits: 0 }
let reason: PromptValueReason | undefined
let thrown: { readonly error: unknown } | null = null
const machineProps = () => ({
  ...(controlled ? { value: value ?? "" } : {}),
  defaultValue,
  ...(ownAttachments !== undefined ? { attachments: ownAttachments } : {}),
  defaultAttachments: defaultAttachments ?? EMPTY,
  status,
  disabled,
  readOnly,
  history,
  accept,
  maxFiles,
  maxFileSize,
  limit: countState?.max,
  count: countState?.count,
  id: instance,
  locale: env.locale.locale(),
  messages,
  onSubmit: (m: PromptMessage, d: PromptSubmitDetails) => onSubmit?.(m, d),
  onStop: () => onStop?.(),
  onReject: (r: readonly FileRejection[]) => onReject?.(r),
  onThrow: (error: unknown) => {
    thrown = { error }
  },
  // Uncontrolled: an undoable edit of the Textarea; its `input` event brings the value back.
  writeDraft: controlled
    ? undefined
    : (text: string, why: PromptValueReason) => {
        const el = textarea.current
        if (!el) return false
        reason = why
        try {
          return replaceText(el, text)
        } finally {
          reason = undefined
        }
      },
  onValueChange: (v: string, d: { event: { type: string } }) => {
    onValueChange?.(v, { reason: promptValueReason(d.event) })
    if (value !== undefined) value = v
  },
  onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) => {
    onAttachmentsChange?.(v, { reason: promptAttachmentsReason(d.event) })
    if (ownAttachments !== undefined) ownAttachments = v
  },
})
// Sound: `machineProps` is the machine's props (the Svelte-only ones are split off above).
const machine = useMachine(promptInputMachine, machineProps as never, env)
const view = $derived(machine.view)
const draft = $derived((view.values.value as string | undefined) ?? "")
const list = $derived((view.values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY)
// The modality tracker must see the pointerdown that comes before a focus.
$effect(() => env.modality.subscribe(() => {}))
const modality = useModality(env.modality, () => view.context.focused || focusedButton !== null)
// Server and hydration: a fine pointer; the client's own after hydration.
let touchPrimary = $state(false)
$effect(() =>
  untrack(() => {
    touchPrimary = env.pointer?.coarse() ?? false
    return env.pointer?.subscribeCoarse(() => {
      touchPrimary = env.pointer?.coarse() ?? false
    })
  }),
)
const api = $derived(
  promptInputConnect(
    {
      instance,
      state: view.state as PromptInputState,
      context: view.context,
      value: draft,
      attachments: list,
      props: { disabled, readOnly, history, limit: countState?.max, count: countState?.count },
      submitKey,
      touchPrimary,
      accept,
      multiple,
      name,
      filesName,
      textareaId,
      countMounted: countState !== null,
      modality: modality.current,
      dir: env.locale.dir(),
      locale: env.locale.locale(),
      messages,
      focusedButton,
      setFocusedButton: (b) => {
        focusedButton = b
      },
      nativeAction: form.action !== undefined,
      takeThrown: () => {
        const t = thrown
        thrown = null
        return t
      },
      takeReason: () => reason,
      send: machine.send,
    },
    env,
  ),
)
// The carrier input holds the attached files, so the form's FormData carries them.
$effect(() => {
  const files = list.flatMap((a) => (a.file ? [a.file] : []))
  const el = untrack(() => env.dom.getById(ids.files))
  if (!(el instanceof HTMLInputElement)) return
  if (files.length > 0 || (el.files?.length ?? 0) > 0) untrack(() => syncFileInput(el, files))
})
// Exactly one Textarea and one Submit (development error otherwise): the parts count
// themselves as they initialise, before this runs.
$effect(() => {
  if (!DEV) return
  if (mounted.textareas !== 1 || mounted.submits !== 1) {
    console.error(
      `[rind-ui] prompt-input: renders ${mounted.textareas} Textarea and ${mounted.submits} Submit parts; exactly one of each is required.`,
    )
  }
})
const control: PromptInputControl = {
  get state() {
    return view.state as PromptInputState
  },
  get value() {
    return draft
  },
  get attachments() {
    return list
  },
  submit: () => api.control.submit(),
  stop: () => api.control.stop(),
  setValue: (v) => api.control.setValue(v),
  insertText: (t) => api.control.insertText(t),
  focus: () => api.control.focus(),
  openFilePicker: () => api.control.openFilePicker(),
  addFiles: (f) => api.control.addFiles(f),
}
promptInput.set({
  api: () => api,
  ids: () => ids,
  value: () => draft,
  controlled: () => controlled,
  defaultValue: () => defaultValue,
  attachments: () => list,
  disabled: () => disabled,
  readOnly: () => readOnly,
  name: () => name,
  control,
  setCount: (c) =>
    untrack(() => {
      countState = c
    }),
  count: () => (countState ? { used: api.derived.used, max: countState.max } : null),
  takeReason: () => reason,
  setTextareaId: (next) =>
    untrack(() => {
      textareaId = next
    }),
  textarea,
  mounted,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.root()), form)))
const { children: _summary, ...summary } = $derived(normalizeProps(api.chipsSummary()))
</script>

{#snippet content()}<FieldHost
    scope="prompt-input"
    rootPart="field"
    id={`${instance}-field`}
    {disabled}
    readonly={readOnly}
    invalid={invalid === true || api.derived.overLimit}
    {...errors ? { errors } : {}}
    {...fieldMessages ? { messages: fieldMessages } : {}}>{@render children?.()}</FieldHost
  ><span {...attrs(summary)}>{api.summaryText}</span><input
    {...attrs(normalizeProps(api.picker()))}
  /><input {...attrs(normalizeProps(api.files()))} />{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <form {...attrs(merged)}>{@render content()}</form>
{/if}
