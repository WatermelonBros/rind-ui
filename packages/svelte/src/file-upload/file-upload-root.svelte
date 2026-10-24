<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  domDropSource,
  type FileLike,
  type FileRejection,
  type FileUploadEvent,
  filesFromClipboard,
  fileUploadConnect,
  fileUploadMachine,
  fileUploadMessages,
  focusSafely,
  mergeFieldProps,
  partId,
  syncFileInput,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { tick, untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { fileUploadContext, preventDocumentDrops } from "./context"
import type { FileUploadRenderState, FileUploadRootProps } from "./types"

let {
  files = $bindable(),
  defaultFiles,
  onFilesChange,
  accept,
  maxFiles = 1,
  maxFileSize,
  minFileSize,
  directory = false,
  validate,
  onReject,
  dropSource,
  preventDocumentDrop = true,
  capture,
  name,
  form,
  disabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: FileUploadRootProps = $props()

const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => ownLocale)
const messages = useMessages("file-upload", fileUploadMessages, () => ownMessages)
const binding = useFieldControl(uid)
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const registry = usePartRegistry<"label">(untrack(() => ({ scope: "file-upload", root: instance })))
const ownLabel = useRenderedId(registry, "label")
let input: HTMLInputElement | null = null
const ids = $derived({
  label: partId("file-upload", instance, "label"),
  trigger: partId("file-upload", instance, "trigger"),
  input: partId("file-upload", instance, "input"),
  summary: partId("file-upload", instance, "summary"),
})
const field = $derived(
  mergeFieldProps(
    {
      role: "button",
      labelable: false,
      disabled: disabled || fieldsetContext() || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding?.() ?? null,
  ),
)
let dispatching = false
const sync = (held: readonly FileLike[], dispatch: boolean) => {
  const el = input
  if (!el) return
  // Only real File objects reach the form; records from another source (paths) never do.
  syncFileInput(
    el,
    held.filter((f): f is File => typeof File !== "undefined" && f instanceof File),
  )
  if (!dispatch) return
  dispatching = true
  try {
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  } finally {
    dispatching = false
  }
}
let lastReason: string | null = null
const machine = useMachine(
  fileUploadMachine,
  () => ({
    id: instance,
    messages: messages(),
    lang: locale.current.locale,
    files,
    defaultFiles,
    onFilesChange: (next: readonly FileLike[], details: ChangeDetails<FileUploadEvent>) => {
      lastReason = details.reason
      let cancelled = false
      onFilesChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && files !== undefined) files = next
    },
    accept,
    maxFiles,
    maxFileSize,
    minFileSize,
    directory,
    validate: validate as never,
    disabled: field.disabled,
    readOnly: field.readOnly,
    onReject: (r: readonly FileRejection<FileLike>[]) => onReject?.(r),
  }),
  {
    ...env,
    // In the press's task: the chooser needs the user activation.
    openPicker: () => input?.click(),
    syncInput: sync,
  },
)
const held = $derived(machine.view.values.files)
const uploadState: FileUploadRenderState<FileLike> = $derived({
  files: held,
  rejections: machine.view.context.rejections,
  dragging: machine.view.state === "dragging",
  disabled: field.disabled,
  readOnly: field.readOnly,
})
const api = $derived(
  fileUploadConnect({
    instance,
    files: held,
    dragging: uploadState.dragging,
    field,
    fieldData: binding?.().data,
    ids,
    labelledBy: binding?.().ids.label ?? ownLabel.current,
    messages: messages(),
    locale: locale.current.locale,
    accept,
    maxFiles,
    directory,
    capture,
    form,
  }),
)
const focusAfterRemoval = { current: null as number | null }
const hasTrigger = { current: false }
const el = elementRef("div")
// After every update, so a controlled proposal the parent ignored leaves the input as the value.
$effect(() => {
  const now = held
  untrack(() => {
    if (!dispatching) sync(now, false)
    // Focus after a removal: the Remove now at that index, else the previous one, else the Trigger.
    const index = focusAfterRemoval.current
    if (index === null) return
    focusAfterRemoval.current = null
    void tick().then(() => {
      const removes = el.current?.querySelectorAll<HTMLElement>('[data-part="item-remove"]')
      const target =
        removes?.[index] ?? removes?.[index - 1] ?? document.getElementById(ids.trigger)
      if (target) void focusSafely(target, env, "programmatic", env.modality.modality())
    })
  })
})
$effect(() => {
  if (!preventDocumentDrop || field.disabled) return
  return untrack(() => preventDocumentDrops())
})
const captureInput = (node: HTMLInputElement) => {
  input = node
  const w = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = w.disabled
  // Form reset and validation focus, on the native input.
  const doc = node.ownerDocument
  const onReset = (e: Event) => {
    if (e.target !== node.form || e.defaultPrevented) return
    machine.send({ type: "RESET" })
    // The browser clears the input after this event: mirror the value again after it.
    queueMicrotask(() =>
      sync(
        untrack(() => held),
        false,
      ),
    )
  }
  const onFocus = () => {
    const trigger = doc.getElementById(untrack(() => ids.trigger))
    if (trigger) void focusSafely(trigger, env, "programmatic", "keyboard")
  }
  doc.addEventListener("reset", onReset)
  node.addEventListener("focus", onFocus)
  sync(
    untrack(() => held),
    false,
  )
  return () => {
    w.stop()
    doc.removeEventListener("reset", onReset)
    node.removeEventListener("focus", onFocus)
    if (input === node) input = null
  }
}
// field-control: one control; the input is its validity element, the Trigger its focus.
$effect(() => {
  if (!binding) return
  const trigger = ids.trigger
  return untrack(() =>
    binding().register(
      {
        id: trigger,
        labelable: false,
        focus: (m) => {
          const t = document.getElementById(trigger)
          if (t) void focusSafely(t, env, "programmatic", m)
        },
        validityElement: () => input,
        value: () => held,
      },
      trigger,
    ),
  )
})
let reported = untrack(() => held)
$effect(() => {
  const now = held
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastReason !== null && lastReason !== "reset"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
    if (user) binding?.().report({ type: "commit" })
  })
})
$effect(() => {
  if (!DEV) return
  untrack(() => {
    if (!hasTrigger.current && !field.disabled)
      console.warn("[rind-ui] file-upload: render FileUpload.Trigger, the keyboard way in")
    if (directory && maxFiles === 1)
      console.warn(
        "[rind-ui] file-upload: `directory` with `maxFiles` 1 keeps one file of a folder",
      )
  })
})
const editable = $derived(!field.disabled && !field.readOnly)
const defaultSource = domDropSource({ directory: () => directory, refuse: () => !editable })
fileUploadContext.set({
  api: () => api,
  send: machine.send,
  state: () => uploadState,
  ids: () => ids,
  registry,
  dropSource: () => dropSource ?? defaultSource,
  focusAfterRemoval,
  hasTrigger,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api.root()), {
          // A paste of files while focus is inside: one gesture (text pastes are the platform's).
          onpaste: (e: ClipboardEvent) => {
            if (!editable) return
            const pasted = filesFromClipboard(e.clipboardData)
            if (!pasted) return
            e.preventDefault()
            machine.send({ type: "FILES.ADD", files: pasted, source: "paste" })
          },
        }),
        ...el.props,
        ...(id === undefined ? {} : { id }),
      },
      rest,
    ),
  ),
)
const inputProps = $derived(normalizeProps(api.hiddenInput()))
const onInputChange = (e: Event) => {
  if (dispatching) return
  const node = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
  const picked = Array.from(node?.files ?? [])
  // A cancelled chooser (older engines report an empty change): keep the files.
  if (picked.length === 0) {
    sync(held, false)
    return
  }
  machine.send({ type: "FILES.ADD", files: picked, source: "pick" })
}
</script>

{#snippet extras()}<input
    {...attrs(inputProps)}
    {@attach captureInput}
    onclick={(e) => e.stopPropagation()}
    onchange={onInputChange}
  /><span {...attrs(normalizeProps(api.summary()))}>{api.summaryText}</span>{/snippet}

{#if child}
  {@render child({ props: merged, state: uploadState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(uploadState)}{@render extras()}</div>
{/if}
