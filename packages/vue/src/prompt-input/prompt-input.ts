// Prompt Input (prompt-input spec): Root owns the machine and renders the form, a Field
// (standalone, or joined to an enclosing one), the hidden file inputs and the attachments
// summary; every other part is wiring. Derived state and keys live in core's connect.
import {
  announcerCapability,
  autosize as attachAutosize,
  type FieldMessages,
  type FileRejection,
  focusSafely,
  type MessageOverrides,
  mergeFieldProps,
  type PromptAttachment,
  type PromptAttachmentsReason,
  type PromptInputApi,
  type PromptInputMessages,
  type PromptInputState,
  type PromptInputStatus,
  type PromptMessage,
  type PromptSubmitDetails,
  type PromptSubmitKey,
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
import {
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

interface CountState {
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

/** What `usePromptInput()` returns: the state and the actions a suggestion or a menu uses. */
export interface PromptInputControl {
  /** The machine state. */
  readonly state: PromptInputState
  /** The draft. */
  readonly value: string
  /** The attachments. */
  readonly attachments: readonly PromptAttachment[]
  /** Sends the draft, through the same checks as Enter. */
  submit(): void
  /** Stops the reply (as Submit does while busy). */
  stop(): void
  /** Replaces the draft (reason `api`); ignored while an IME composition is open. */
  setValue(value: string): void
  /** Inserts text at the caret (or over the selection); ignored while composing. */
  insertText(text: string): void
  /** Focuses the Textarea. */
  focus(): void
  /** Opens the file chooser. */
  openFilePicker(): void
  /** Adds files, through the same checks as a drop. */
  addFiles(files: readonly File[]): void
}

interface Host {
  readonly api: () => PromptInputApi
  readonly ids: () => ReturnType<typeof promptInputIds>
  readonly value: () => string
  readonly controlled: () => boolean
  readonly defaultValue: () => string
  readonly attachments: () => readonly PromptAttachment[]
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly name: () => string
  readonly control: PromptInputControl
  readonly setCount: (c: CountState | null) => void
  readonly count: () => { readonly used: number; readonly max: number | undefined } | null
  readonly setTextareaId: (id: string) => void
  readonly textarea: { current: HTMLTextAreaElement | null }
  readonly mounted: { textareas: number; submits: number }
}

const HostKey: InjectionKey<Host> = Symbol("rind-ui.prompt-input")
const useHost = (part: string): Host => {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`PromptInput.${part} must be inside PromptInput.Root`)
  return host
}

/** The Prompt Input's state and actions, from inside `PromptInput.Root` (call in setup). */
export function usePromptInput(): PromptInputControl {
  return useHost("usePromptInput").control
}

const EMPTY: readonly PromptAttachment[] = []

const Root = defineComponent({
  name: "PromptInputRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** The draft (controlled, `v-model:value`). The machine's own writes are then proposals. */
    value: { type: String, default: undefined },
    /** The initial draft (uncontrolled: the Textarea owns its value, writes are undoable). */
    defaultValue: { type: String, default: "" },
    /** The attachments (controlled, `v-model:attachments`). */
    attachments: { type: Array as PropType<readonly PromptAttachment[]>, default: undefined },
    /** The initial attachments (uncontrolled). Default none. */
    defaultAttachments: Array as PropType<readonly PromptAttachment[]>,
    /**
     * Sends the prompt: called once per send with the draft and attachments as they were; both
     * clear at once. Return a promise to stay `submitting` until it settles; a rejection
     * restores the prompt into an empty draft. A synchronous throw fails the send and is
     * rethrown to whatever submitted.
     */
    onSubmit: Function as PropType<
      (message: PromptMessage, details: PromptSubmitDetails) => unknown
    >,
    /**
     * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
     * it, `error` fails the send.
     */
    status: String as PropType<PromptInputStatus>,
    /** Submit was pressed while a reply is on its way. */
    onStop: Function as PropType<() => void>,
    /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
    onReject: Function as PropType<(rejections: readonly FileRejection[]) => void>,
    /**
     * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
     * `"none"` (only Submit). Mod+Enter always sends; with a coarse primary pointer (phones,
     * tablets) Enter is a newline. Default `"enter"`.
     */
    submitKey: { type: String as PropType<PromptSubmitKey>, default: "enter" },
    /** Past prompts, newest last: ArrowUp in an empty draft recalls them. */
    history: Array as PropType<readonly string[]>,
    /** Accepted files, as `<input accept>`: MIME types, `type/*` and `.ext`. */
    accept: String,
    /** The file chooser picks several files. Default `true`. */
    multiple: { type: Boolean, default: true },
    /** The most attachments at once; more are refused. */
    maxFiles: Number,
    /** The largest file, in bytes; larger ones are refused. */
    maxFileSize: Number,
    /** The Textarea's form name. Default `"message"`. */
    name: { type: String, default: "message" },
    /** The attached files' form name. Default `"files"`. */
    filesName: { type: String, default: "files" },
    /** Disables every part: typing, sending, files. */
    disabled: Boolean,
    /** No typing and no files; the draft can still be sent. */
    readOnly: Boolean,
    /** The Field is invalid (also while over a CharacterCount's max). */
    invalid: { type: Boolean, default: undefined },
    /** The Field's error messages (PromptInput.ErrorMessage shows them). */
    errors: Array as PropType<readonly string[]>,
    /** Replaces any string that reaches assistive technology. */
    messages: Object as PropType<Partial<PromptInputMessages>>,
    /** Replaces the Field's own strings. */
    fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  },
  emits: {
    /** Every draft change: typing, the clear on send, a restore after a failure, a recall. */
    valueChange: (_value: string, _details: { readonly reason: PromptValueReason }) => true,
    "update:value": (_value: string) => true,
    /** Every attachments change: added files, removals, the clear on send, a restore. */
    attachmentsChange: (
      _attachments: readonly PromptAttachment[],
      _details: { readonly reason: PromptAttachmentsReason },
    ) => true,
    "update:attachments": (_attachments: readonly PromptAttachment[]) => true,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const ids = computed(() => promptInputIds(instance()))
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readOnly || enclosing?.value.state.readOnly === true
    const messages = computed(() => ({ ...promptInputMessages, ...props.messages }))
    const controlled = () => props.value !== undefined
    const countState = shallowRef<CountState | null>(null)
    const textareaId = shallowRef(ids.value.textarea)
    const focusedButton = shallowRef<"submit" | "attach-trigger" | null>(null)
    const textarea: Host["textarea"] = { current: null }
    const mounted = { textareas: 0, submits: 0 }
    let reason: PromptValueReason | undefined
    let thrown: { readonly error: unknown } | null = null
    const machineProps = () => ({
      ...(controlled() ? { value: props.value ?? "" } : {}),
      defaultValue: props.defaultValue,
      ...(props.attachments !== undefined ? { attachments: props.attachments } : {}),
      defaultAttachments: props.defaultAttachments ?? EMPTY,
      status: props.status,
      disabled: disabled(),
      readOnly: readOnly(),
      history: props.history,
      accept: props.accept,
      maxFiles: props.maxFiles,
      maxFileSize: props.maxFileSize,
      limit: countState.value?.max,
      count: countState.value?.count,
      id: instance(),
      locale: env.locale.locale(),
      messages: messages.value,
      onSubmit: (m: PromptMessage, d: PromptSubmitDetails) => props.onSubmit?.(m, d),
      onStop: () => props.onStop?.(),
      onReject: (r: readonly FileRejection[]) => props.onReject?.(r),
      onThrow: (error: unknown) => {
        thrown = { error }
      },
      // Uncontrolled: an undoable edit of the Textarea; its `input` event brings the value back.
      writeDraft: controlled()
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
        emit("valueChange", v, { reason: promptValueReason(d.event) })
        emit("update:value", v)
      },
      onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) => {
        emit("attachmentsChange", v, { reason: promptAttachmentsReason(d.event) })
        emit("update:attachments", v)
      },
    })
    // Sound: `machineProps` is the machine's props (the Vue-only ones are split off above).
    const { view, service } = useMachine(promptInputMachine, machineProps as never, env)
    const value = () => (view.value.values.value as string | undefined) ?? ""
    const attachments = () =>
      (view.value.values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY
    // The modality tracker must see the pointerdown that comes before a focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const modality = useModality(
      env.modality,
      () => view.value.context.focused || focusedButton.value !== null,
    )
    // Server and hydration: a fine pointer; the client's own after hydration.
    const touchPrimary = shallowRef(false)
    onMounted(() => {
      touchPrimary.value = env.pointer?.coarse() ?? false
      const off = env.pointer?.subscribeCoarse(() => {
        touchPrimary.value = env.pointer?.coarse() ?? false
      })
      if (off) onBeforeUnmount(off)
    })
    const api = computed(() =>
      promptInputConnect(
        {
          instance: instance(),
          state: view.value.state as PromptInputState,
          context: view.value.context,
          value: value(),
          attachments: attachments(),
          props: {
            disabled: disabled(),
            readOnly: readOnly(),
            history: props.history,
            limit: countState.value?.max,
            count: countState.value?.count,
          },
          submitKey: props.submitKey,
          touchPrimary: touchPrimary.value,
          accept: props.accept,
          multiple: props.multiple,
          name: props.name,
          filesName: props.filesName,
          textareaId: textareaId.value,
          countMounted: countState.value !== null,
          modality: modality.value,
          dir: env.locale.dir(),
          locale: env.locale.locale(),
          messages: messages.value,
          focusedButton: focusedButton.value,
          setFocusedButton: (b) => {
            focusedButton.value = b
          },
          nativeAction: attrs["action"] !== undefined,
          takeThrown: () => {
            const t = thrown
            thrown = null
            return t
          },
          takeReason: () => reason,
          send: service.send,
        },
        env,
      ),
    )
    // The carrier input holds the attached files, so the form's FormData carries them.
    const syncFiles = () => {
      const el = env.dom.getById(ids.value.files)
      if (!(el instanceof HTMLInputElement)) return
      const files = attachments().flatMap((a) => (a.file ? [a.file] : []))
      if (files.length > 0 || (el.files?.length ?? 0) > 0) syncFileInput(el, files)
    }
    onMounted(() => {
      watch(attachments, syncFiles, { immediate: true, flush: "post" })
      // Exactly one Textarea and one Submit (development error otherwise).
      if (process.env.NODE_ENV === "production") return
      if (mounted.textareas !== 1 || mounted.submits !== 1) {
        console.error(
          `[rind-ui] prompt-input: renders ${mounted.textareas} Textarea and ${mounted.submits} Submit parts; exactly one of each is required.`,
        )
      }
    })
    const control: PromptInputControl = {
      get state() {
        return view.value.state as PromptInputState
      },
      get value() {
        return value()
      },
      get attachments() {
        return attachments()
      },
      submit: () => api.value.control.submit(),
      stop: () => api.value.control.stop(),
      setValue: (v) => api.value.control.setValue(v),
      insertText: (t) => api.value.control.insertText(t),
      focus: () => api.value.control.focus(),
      openFilePicker: () => api.value.control.openFilePicker(),
      addFiles: (f) => api.value.control.addFiles(f),
    }
    provide(HostKey, {
      api: () => api.value,
      ids: () => ids.value,
      value,
      controlled,
      defaultValue: () => props.defaultValue,
      attachments,
      disabled,
      readOnly,
      name: () => props.name,
      control,
      setCount: (c) => {
        countState.value = c
      },
      count: () =>
        countState.value ? { used: api.value.derived.used, max: countState.value.max } : null,
      setTextareaId: (id) => {
        textareaId.value = id
      },
      textarea,
      mounted,
    })
    return () => {
      const a = api.value
      const { children: _summary, ...summary } = normalizeProps(a.chipsSummary())
      void _summary
      return renderPart(
        "form",
        mergeProps(normalizeProps(a.root()), attrs),
        h(Fragment, [
          h(
            FieldHost,
            {
              scope: "prompt-input",
              rootPart: "field",
              id: `${instance()}-field`,
              disabled: disabled(),
              readonly: readOnly(),
              invalid: props.invalid === true || a.derived.overLimit,
              ...(props.errors ? { errors: props.errors } : {}),
              ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
            } as never,
            () => slots.default?.(),
          ),
          h("span", summary, a.summaryText),
          h("input", normalizeProps(a.picker())),
          h("input", normalizeProps(a.files())),
        ]),
        props.asChild,
      )
    }
  },
})

/** Counts a part for the "exactly one" development check. */
function useCounted(host: Host, key: "textareas" | "submits") {
  onMounted(() => {
    host.mounted[key] += 1
  })
  onBeforeUnmount(() => {
    host.mounted[key] -= 1
  })
}

const Textarea = defineComponent({
  name: "PromptInputTextarea",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
    autosize: { type: Boolean, default: true },
  },
  setup(props, { attrs }) {
    const host = useHost("Textarea")
    useCounted(host, "textareas")
    const env = useEnvironment()
    const binding = useFieldControl()
    const el = shallowRef<Element | null>(null)
    // The Field's control id first: its Label is `for` it from the first render.
    const controlId = () => props.id ?? binding?.value.controlId ?? host.ids().textarea
    let unregister: (() => void) | undefined
    let handle: ReturnType<typeof attachAutosize> | null = null
    onMounted(() => {
      watch(controlId, (id) => host.setTextareaId(id), { immediate: true })
      host.textarea.current = el.value as HTMLTextAreaElement | null
      watch(
        controlId,
        (id) => {
          unregister?.()
          unregister = binding?.value.register(
            {
              id,
              labelable: true,
              focus: (modality) => {
                if (el.value instanceof HTMLElement) {
                  void focusSafely(el.value, env, "programmatic", modality)
                }
              },
              validityElement: () => el.value as HTMLTextAreaElement | null,
              value: () => (el.value as HTMLTextAreaElement | null)?.value ?? "",
            },
            id,
          )
        },
        { immediate: true },
      )
      watch(
        () => props.autosize,
        (on, _, onCleanup) => {
          if (!on || !(el.value instanceof HTMLTextAreaElement)) return
          const a = attachAutosize(el.value, env)
          handle = a
          onCleanup(() => {
            a.dispose()
            handle = null
          })
        },
        { immediate: true },
      )
      // Every value commit (typing, the clear on send, a restore, a recall) re-measures.
      watch(host.value, () => handle?.measure(), { flush: "post" })
      // Development: the placeholder is never a name. Checked once the Field's Label settled
      // (its `for` follows the registered control).
      if (process.env.NODE_ENV !== "production") {
        const frame = env.scheduler.requestAnimationFrame(() => {
          const node = el.value as HTMLTextAreaElement | null
          if (!node) return
          const named =
            (node.labels?.length ?? 0) > 0 ||
            node.hasAttribute("aria-label") ||
            node.hasAttribute("aria-labelledby")
          if (!named) {
            console.warn(
              "[rind-ui] prompt-input: the Textarea has no accessible name: render a PromptInput.Label or pass aria-label (a placeholder is not a name).",
            )
          }
        })
        onBeforeUnmount(() => env.scheduler.cancelAnimationFrame(frame))
      }
    })
    onBeforeUnmount(() => {
      unregister?.()
      host.textarea.current = null
    })
    return () => {
      const {
        "aria-describedby": describedBy,
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
        ...rest
      } = attrs
      const field = mergeFieldProps(
        {
          role: "textbox",
          labelable: true,
          disabled: host.disabled(),
          readOnly: host.readOnly(),
          invalid: host.api().derived.overLimit,
          name: host.name(),
          consumerDescribedBy: describedBy as string | undefined,
          ariaLabel: ariaLabel as string | undefined,
          ariaLabelledBy: ariaLabelledBy as string | undefined,
        },
        binding?.value ?? null,
      )
      return renderPart(
        "textarea",
        mergeProps(
          normalizeProps({
            ...host.api().textarea(field),
            ...(host.controlled()
              ? { value: host.value() }
              : { defaultValue: host.defaultValue() }),
          }),
          {
            ref: refTo(el),
            // The Field validates on the control's changes.
            onInput: (e: InputEvent) =>
              binding?.value.report({
                type: "change",
                value: (e.target as HTMLTextAreaElement).value,
                user: true,
                composing: e.isComposing === true,
              }),
          },
          rest,
        ),
        undefined,
        props.asChild,
      )
    }
  },
})

const Submit = defineComponent({
  name: "PromptInputSubmit",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const host = useHost("Submit")
    useCounted(host, "submits")
    return () =>
      renderPart(
        "button",
        mergeProps(normalizeProps(host.api().submit()), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const AttachTrigger = defineComponent({
  name: "PromptInputAttachTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const host = useHost("AttachTrigger")
    return () =>
      renderPart(
        "button",
        mergeProps(normalizeProps(host.api().attachTrigger()), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

interface Chip {
  readonly key: string
  readonly attachment: PromptAttachment
}
const ChipKey: InjectionKey<() => Chip> = Symbol("rind-ui.prompt-input-chip")
const useChip = (part: string) => {
  const c = inject(ChipKey, null)
  if (c === null) throw new Error(`PromptInput.${part} must be inside PromptInput.Attachments`)
  return c
}

/** Provides one attachment to the chip parts inside it. */
const ChipScope = defineComponent({
  name: "PromptInputChipScope",
  props: { attachment: { type: Object as PropType<PromptAttachment>, required: true } },
  setup(props, { slots }) {
    provide(ChipKey, () => ({ key: props.attachment.id, attachment: props.attachment }))
    return () => slots["default"]?.()
  },
})

/** The attachments toolbar: one Attachment per file. Renders nothing while empty. */
const Attachments = defineComponent({
  name: "PromptInputAttachments",
  inheritAttrs: false,
  props: { ...asChildProp },
  /** Renders one attachment; default: its name and its remove button. */
  slots: Object as SlotsType<{ default?: (attachment: PromptAttachment) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const host = useHost("Attachments")
    return () => {
      const list = host.attachments()
      if (list.length === 0) return null
      return renderPart(
        "div",
        mergeProps(normalizeProps(host.api().chipsPart()), attrs),
        list.map((attachment) =>
          h(ChipScope, { key: attachment.id, attachment }, () =>
            slots.default
              ? slots.default(attachment)
              : h(Attachment, null, () => [h(AttachmentName), h(AttachmentRemove)]),
          ),
        ),
        props.asChild,
      )
    }
  },
})

const Attachment = defineComponent({
  name: "PromptInputAttachment",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const host = useHost("Attachment")
    const chip = useChip("Attachment")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.api().chip(chip().key)), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const AttachmentName = defineComponent({
  name: "PromptInputAttachmentName",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const host = useHost("AttachmentName")
    const chip = useChip("AttachmentName")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.api().chipText()), attrs),
        slots["default"]?.() ?? chip().attachment.name,
        props.asChild,
      )
  },
})

const AttachmentRemove = defineComponent({
  name: "PromptInputAttachmentRemove",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const host = useHost("AttachmentRemove")
    const chip = useChip("AttachmentRemove")
    return () =>
      renderPart(
        "button",
        mergeProps(normalizeProps(host.api().chipRemove(chip().key)), attrs),
        slots["default"]?.() ?? h("span", { "aria-hidden": "true" }, "×"),
        props.asChild,
      )
  },
})

const CharacterCount = defineComponent({
  name: "PromptInputCharacterCount",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** A soft limit: over it, nothing is sent and the input is invalid; never a truncation. */
    max: Number,
    /** Counts the draft (a tokenizer for a token limit). Default: characters, a line break once. */
    count: Function as PropType<(value: string) => number>,
  },
  setup(props, { attrs, slots }) {
    const host = useHost("CharacterCount")
    onMounted(() =>
      watch(
        () => [props.max, props.count] as const,
        ([max, count]) => host.setCount({ max, count }),
        { immediate: true },
      ),
    )
    onBeforeUnmount(() => host.setCount(null))
    return () => {
      // Frozen at the committed draft while a composition is open (core's derivation).
      const used = host.count()?.used ?? 0
      return renderPart(
        "span",
        mergeProps(normalizeProps(host.api().characterCount()), attrs),
        slots["default"]?.() ?? (props.max === undefined ? `${used}` : `${used}/${props.max}`),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `prompt-input.parts.ts` re-exports them as the `PromptInput` namespace. */
export {
  Attachment,
  AttachmentName,
  AttachmentRemove,
  Attachments,
  AttachTrigger,
  CharacterCount,
  HostDescription as Description,
  HostErrorMessage as ErrorMessage,
  HostLabel as Label,
  Root,
  Submit,
  Textarea,
}
