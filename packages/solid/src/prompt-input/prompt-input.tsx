/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

export interface PromptInputRootProps
  extends Omit<JSX.HTMLAttributes<HTMLFormElement>, "onSubmit" | "children" | "id"> {
  readonly id?: string | undefined
  /** The parts. */
  readonly children?: JSX.Element
  /** Substitutes the `<form>` element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  /** The draft (controlled). The machine's own writes are then plain proposals. */
  readonly value?: string | undefined
  /** The initial draft (uncontrolled: the Textarea owns its value, writes are undoable). */
  readonly defaultValue?: string | undefined
  /** Every draft change: typing, the clear on send, a restore after a failure, a recall. */
  readonly onValueChange?:
    | ((value: string, details: { readonly reason: PromptValueReason }) => void)
    | undefined
  /** The attachments (controlled). */
  readonly attachments?: readonly PromptAttachment[] | undefined
  /** The initial attachments (uncontrolled). Default none. */
  readonly defaultAttachments?: readonly PromptAttachment[] | undefined
  /** Every attachments change: added files, removals, the clear on send, a restore. */
  readonly onAttachmentsChange?:
    | ((
        attachments: readonly PromptAttachment[],
        details: { readonly reason: PromptAttachmentsReason },
      ) => void)
    | undefined
  /**
   * Sends the prompt: called once per send with the draft and attachments as they were; both
   * clear at once. Return a promise to stay `submitting` until it settles; a rejection
   * restores the prompt into an empty draft. A synchronous throw fails the send and is
   * rethrown to whatever submitted.
   */
  readonly onSubmit?:
    | ((message: PromptMessage, details: PromptSubmitDetails) => unknown)
    | undefined
  /**
   * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
   * it, `error` fails the send.
   */
  readonly status?: PromptInputStatus | undefined
  /** Submit was pressed while a reply is on its way. */
  readonly onStop?: (() => void) | undefined
  /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
  readonly onReject?: ((rejections: readonly FileRejection[]) => void) | undefined
  /**
   * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
   * `"none"` (only Submit). Mod+Enter always sends; with a coarse primary pointer (phones,
   * tablets) Enter is a newline. Default `"enter"`.
   */
  readonly submitKey?: PromptSubmitKey | undefined
  /** Past prompts, newest last: ArrowUp in an empty draft recalls them. */
  readonly history?: readonly string[] | undefined
  /** Accepted files, as `<input accept>`: MIME types, `type/*` and `.ext`. */
  readonly accept?: string | undefined
  /** The file chooser picks several files. Default `true`. */
  readonly multiple?: boolean | undefined
  /** The most attachments at once; more are refused. */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes; larger ones are refused. */
  readonly maxFileSize?: number | undefined
  /** The Textarea's form name. Default `"message"`. */
  readonly name?: string | undefined
  /** The attached files' form name. Default `"files"`. */
  readonly filesName?: string | undefined
  /** Disables every part: typing, sending, files. */
  readonly disabled?: boolean | undefined
  /** No typing and no files; the draft can still be sent. */
  readonly readOnly?: boolean | undefined
  /** The Field is invalid (also while over a CharacterCount's max). */
  readonly invalid?: boolean | undefined
  /** The Field's error messages (PromptInput.ErrorMessage shows them). */
  readonly errors?: readonly string[] | undefined
  /** Replaces any string that reaches assistive technology. */
  readonly messages?: Partial<PromptInputMessages> | undefined
  /** Replaces the Field's own strings. */
  readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
}

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
  readonly api: Accessor<PromptInputApi>
  readonly ids: Accessor<ReturnType<typeof promptInputIds>>
  readonly value: Accessor<string>
  readonly controlled: Accessor<boolean>
  readonly defaultValue: Accessor<string>
  readonly attachments: Accessor<readonly PromptAttachment[]>
  readonly disabled: Accessor<boolean>
  readonly readOnly: Accessor<boolean>
  readonly name: Accessor<string>
  readonly control: PromptInputControl
  readonly setCount: (c: CountState | null) => void
  readonly count: Accessor<{ readonly used: number; readonly max: number | undefined } | null>
  readonly setTextareaId: (id: string) => void
  /** Set while the machine writes the draft itself (a send, history, restore). */
  readonly takeReason: () => unknown
  readonly textarea: { current: HTMLTextAreaElement | null }
  readonly mounted: { textareas: number; submits: number }
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`PromptInput.${part} must be inside PromptInput.Root`)
  return host
}

/** The Prompt Input's state and actions, from inside `PromptInput.Root`. */
export function usePromptInput(): PromptInputControl {
  return useHost("usePromptInput").control
}

const EMPTY: readonly PromptAttachment[] = []

const ROOT_KEYS = [
  "id",
  "children",
  "render",
  "value",
  "defaultValue",
  "onValueChange",
  "attachments",
  "defaultAttachments",
  "onAttachmentsChange",
  "onSubmit",
  "status",
  "onStop",
  "onReject",
  "submitKey",
  "history",
  "accept",
  "multiple",
  "maxFiles",
  "maxFileSize",
  "name",
  "filesName",
  "disabled",
  "readOnly",
  "invalid",
  "errors",
  "messages",
  "fieldMessages",
] as const

function Root(props: PromptInputRootProps) {
  const [local, form] = splitProps(props, ROOT_KEYS)
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => local.id)
  const ids = createMemo(() => promptInputIds(instance()))
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    local.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => local.readOnly === true || enclosing?.().state.readOnly === true
  const messages = createMemo(() => ({ ...promptInputMessages, ...local.messages }))
  const controlled = () => local.value !== undefined
  const defaultValue = () => local.defaultValue ?? ""
  const name = () => local.name ?? "message"
  const [countState, setCount] = createSignal<CountState | null>(null)
  const [textareaId, setTextareaId] = createSignal(untrack(ids).textarea)
  const [focusedButton, setFocusedButton] = createSignal<"submit" | "attach-trigger" | null>(null)
  const textarea: Host["textarea"] = { current: null }
  const mounted = { textareas: 0, submits: 0 }
  let reason: PromptValueReason | undefined
  let thrown: { readonly error: unknown } | null = null
  const machineProps = createMemo(
    () =>
      ({
        ...(controlled() ? { value: local.value ?? "" } : {}),
        defaultValue: defaultValue(),
        ...("attachments" in props ? { attachments: local.attachments ?? EMPTY } : {}),
        defaultAttachments: local.defaultAttachments ?? EMPTY,
        status: local.status,
        disabled: disabled(),
        readOnly: readOnly(),
        history: local.history,
        accept: local.accept,
        maxFiles: local.maxFiles,
        maxFileSize: local.maxFileSize,
        limit: countState()?.max,
        count: countState()?.count,
        id: instance(),
        locale: env.locale.locale(),
        messages: messages(),
        onSubmit: (m: PromptMessage, d: PromptSubmitDetails) => local.onSubmit?.(m, d),
        onStop: () => local.onStop?.(),
        onReject: (r: readonly FileRejection[]) => local.onReject?.(r),
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
        onValueChange: (v: string, d: { event: { type: string } }) =>
          local.onValueChange?.(v, { reason: promptValueReason(d.event) }),
        onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) =>
          local.onAttachmentsChange?.(v, { reason: promptAttachmentsReason(d.event) }),
      }) as never,
  )
  const { view, service } = useMachine(promptInputMachine, machineProps, env)
  const value = () => (view().values.value as string | undefined) ?? ""
  const attachments = () =>
    (view().values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY
  // The modality tracker must see the pointerdown that comes before a focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const modality = useModality(
    env.modality,
    () => view().context.focused || focusedButton() !== null,
  )
  // Server and hydration: a fine pointer; the client's own after hydration.
  const [touchPrimary, setTouchPrimary] = createSignal(false)
  afterMount(() => {
    setTouchPrimary(env.pointer?.coarse() ?? false)
    const off = env.pointer?.subscribeCoarse(() => setTouchPrimary(env.pointer?.coarse() ?? false))
    if (off) onCleanup(off)
  })
  const api = createMemo(() =>
    promptInputConnect(
      {
        instance: instance(),
        state: view().state as PromptInputState,
        context: view().context,
        value: value(),
        attachments: attachments(),
        props: {
          disabled: disabled(),
          readOnly: readOnly(),
          history: local.history,
          limit: countState()?.max,
          count: countState()?.count,
        },
        submitKey: local.submitKey ?? "enter",
        touchPrimary: touchPrimary(),
        accept: local.accept,
        multiple: local.multiple ?? true,
        name: name(),
        filesName: local.filesName ?? "files",
        textareaId: textareaId(),
        countMounted: countState() !== null,
        modality: modality(),
        dir: env.locale.dir(),
        locale: env.locale.locale(),
        messages: messages(),
        focusedButton: focusedButton(),
        setFocusedButton,
        nativeAction: form["action" as keyof typeof form] !== undefined,
        takeThrown: () => {
          const t = thrown
          thrown = null
          return t
        },
        takeReason: () => reason,
        send: service.send,
      } as Parameters<typeof promptInputConnect>[0],
      env,
    ),
  )
  afterMount(() => {
    // The carrier input holds the attached files, so the form's FormData carries them.
    createEffect(() => {
      const list = attachments()
      const el = env.dom.getById(ids().files)
      if (!(el instanceof HTMLInputElement)) return
      const files = list.flatMap((a) => (a.file ? [a.file] : []))
      if (files.length > 0 || (el.files?.length ?? 0) > 0) syncFileInput(el, files)
    })
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
      return view().state as PromptInputState
    },
    get value() {
      return value()
    },
    get attachments() {
      return attachments()
    },
    submit: () => untrack(api).control.submit(),
    stop: () => untrack(api).control.stop(),
    setValue: (v) => untrack(api).control.setValue(v),
    insertText: (t) => untrack(api).control.insertText(t),
    focus: () => untrack(api).control.focus(),
    openFilePicker: () => untrack(api).control.openFilePicker(),
    addFiles: (f) => untrack(api).control.addFiles(f),
  }
  const host: Host = {
    api,
    ids,
    value,
    controlled,
    defaultValue,
    attachments,
    disabled,
    readOnly,
    name,
    control,
    setCount,
    count: () => {
      const c = countState()
      return c ? { used: api().derived.used, max: c.max } : null
    },
    setTextareaId,
    takeReason: () => reason,
    textarea,
    mounted,
  }
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), form))
  const summary = createMemo(() => normalizeProps(api().chipsSummary()))
  const picker = createMemo(() => normalizeProps(api().picker()))
  const files = createMemo(() => normalizeProps(api().files()))
  const children = () => (
    <>
      <FieldHost
        scope="prompt-input"
        rootPart="field"
        id={`${instance()}-field`}
        disabled={disabled()}
        readOnly={readOnly()}
        invalid={local.invalid === true || api().derived.overLimit}
        errors={local.errors}
        messages={local.fieldMessages}
      >
        {local.children}
      </FieldHost>
      <span {...summary()}>{api().summaryText}</span>
      <input {...picker()} />
      <input {...files()} />
    </>
  )
  return (
    <HostContext.Provider value={host}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <form {...p}>{children()}</form>
      ))}
    </HostContext.Provider>
  )
}

type Own<A> = Omit<A, "children"> & {
  /** Substitutes the rendered element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** Counts a part for the "exactly one" development check. */
function useCounted(host: Host, key: "textareas" | "submits") {
  host.mounted[key] += 1
  onCleanup(() => {
    host.mounted[key] -= 1
  })
}

export type PromptInputTextareaProps = Omit<
  Own<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>>,
  "value" | "children"
> & {
  /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
  readonly autosize?: boolean | undefined
}

function Textarea(props: PromptInputTextareaProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "autosize",
    "id",
    "aria-describedby",
    "aria-label",
    "aria-labelledby",
  ])
  const host = useHost("Textarea")
  useCounted(host, "textareas")
  const env = useEnvironment()
  const binding = useFieldControl()
  const [el, setEl] = createSignal<Element | null>(null)
  // The Field's control id first: its Label is `for` it from the first render.
  const controlId = createMemo(() => local.id ?? binding?.().controlId ?? host.ids().textarea)
  createEffect(() => host.setTextareaId(controlId()))
  afterMount(() => {
    createEffect(() => {
      const node = el()
      host.textarea.current = node instanceof HTMLTextAreaElement ? node : null
    })
    onCleanup(() => {
      host.textarea.current = null
    })
    if (binding) {
      createEffect(() => {
        const id = controlId()
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: true,
                focus: (modality) => {
                  const node = el()
                  if (node instanceof HTMLElement)
                    void focusSafely(node, env, "programmatic", modality)
                },
                validityElement: () => {
                  const node = el()
                  return node instanceof HTMLTextAreaElement ? node : null
                },
                value: () => {
                  const node = el()
                  return node instanceof HTMLTextAreaElement ? node.value : ""
                },
              },
              id,
            ),
          ),
        )
      })
    }
    let handle: ReturnType<typeof attachAutosize> | null = null
    createEffect(() => {
      const on = local.autosize !== false
      const node = el()
      handle?.dispose()
      handle = null
      if (on && node instanceof HTMLTextAreaElement) handle = attachAutosize(node, env)
    })
    onCleanup(() => handle?.dispose())
    // Every value commit (typing, the clear on send, a restore, a recall) re-measures.
    createEffect(on(host.value, () => handle?.measure(), { defer: true }))
    // Development: the placeholder is never a name. Checked once the Field's Label settled
    // (its `for` follows the registered control).
    if (process.env.NODE_ENV !== "production") {
      const frame = env.scheduler.requestAnimationFrame(() => {
        const node = untrack(el)
        if (!(node instanceof HTMLTextAreaElement)) return
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
      onCleanup(() => env.scheduler.cancelAnimationFrame(frame))
    }
  })
  const full = createMemo(() => {
    const field = mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: host.disabled(),
        readOnly: host.readOnly(),
        invalid: host.api().derived.overLimit,
        name: host.name(),
        consumerDescribedBy: local["aria-describedby"],
        ariaLabel: local["aria-label"],
        ariaLabelledBy: local["aria-labelledby"],
      },
      binding?.() ?? null,
    )
    return mergeProps(
      normalizeProps({
        ...host.api().textarea(field),
        ...(host.controlled() ? { value: host.value() } : { defaultValue: host.defaultValue() }),
      }),
      {
        ref: setEl,
        // The Field validates on the control's changes.
        onInput: (e: InputEvent) =>
          binding?.().report({
            type: "change",
            value: (e.target as HTMLTextAreaElement).value,
            // The machine's own writes (a send clearing the draft) are not the user's.
            user: host.takeReason() === undefined,
            composing: e.isComposing === true,
          }),
      },
      rest,
    )
  })
  // A textarea's default is its text (the `value` attribute is not one there).
  const text = () => full()["attr:value"] as string | undefined
  const merged = createMemo(() => {
    const { "attr:value": _text, ...p } = full()
    return p
  })
  return renderPart(
    local.render,
    merged,
    undefined,
    () => undefined,
    (p) => <textarea {...p}>{text()}</textarea>,
  )
}

function Submit(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Submit")
  useCounted(host, "submits")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().submit()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function AttachTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("AttachTrigger")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().attachTrigger()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

const ChipContext = createContext<{
  readonly key: string
  readonly attachment: PromptAttachment
}>()

/** The attachments toolbar: one Attachment per file. Renders nothing while empty. */
function Attachments(
  props: Omit<Own<JSX.HTMLAttributes<HTMLDivElement>>, "children"> & {
    /** Renders one attachment; default: its name and its remove button. */
    readonly children?: (attachment: PromptAttachment) => JSX.Element
  },
) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Attachments")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipsPart()), rest))
  const children = () => (
    <For each={host.attachments()}>
      {(attachment) => (
        <ChipContext.Provider value={{ key: attachment.id, attachment }}>
          {local.children ? (
            local.children(attachment)
          ) : (
            <Attachment>
              <AttachmentName />
              <AttachmentRemove />
            </Attachment>
          )}
        </ChipContext.Provider>
      )}
    </For>
  )
  return (
    <Show when={host.attachments().length > 0}>
      {untrack(() =>
        renderPart(local.render, merged, undefined, children, (p) => (
          <div {...p}>{children()}</div>
        )),
      )}
    </Show>
  )
}

const useChip = (part: string) => {
  const c = useContext(ChipContext)
  if (c === undefined) throw new Error(`PromptInput.${part} must be inside PromptInput.Attachments`)
  return c
}

function Attachment(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Attachment")
  const { key } = useChip("Attachment")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chip(key)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function AttachmentName(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("AttachmentName")
  const { attachment } = useChip("AttachmentName")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipText()), rest))
  const children = () => local.children ?? attachment.name
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function AttachmentRemove(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("AttachmentRemove")
  const { key } = useChip("AttachmentRemove")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipRemove(key)), rest))
  const children = () => local.children ?? <span aria-hidden="true">×</span>
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function CharacterCount(
  props: Own<JSX.HTMLAttributes<HTMLSpanElement>> & {
    /** A soft limit: over it, nothing is sent and the input is invalid; never a truncation. */
    readonly max?: number | undefined
    /** Counts the draft (a tokenizer for a token limit). Default: characters, a line break once. */
    readonly count?: ((value: string) => number) | undefined
  },
) {
  const [local, rest] = splitProps(props, ["render", "max", "count", "children"])
  const host = useHost("CharacterCount")
  createEffect(() => {
    host.setCount({ max: local.max, count: local.count })
    onCleanup(() => host.setCount(null))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().characterCount()), rest))
  // Frozen at the committed draft while a composition is open (core's derivation).
  const children = () => {
    if (local.children !== undefined) return local.children
    const used = host.count()?.used ?? 0
    return local.max === undefined ? `${used}` : `${used}/${local.max}`
  }
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

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
