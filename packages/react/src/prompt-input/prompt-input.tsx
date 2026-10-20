"use client"

// Prompt Input (prompt-input spec): Root owns the machine and renders the form, a Field
// (standalone, or joined to an enclosing one), the hidden file inputs and the attachments
// summary; every other part is wiring. Derived state and keys live in core's connect.

import {
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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface PromptInputRootProps
  extends Omit<ComponentPropsWithRef<"form">, "onSubmit" | "defaultValue" | "children"> {
  /** The parts. */
  readonly children?: ReactNode
  /** Substitutes the `<form>` element. */
  readonly render?: RenderProp<undefined>
  /** The draft (controlled). The machine's own writes are then plain proposals. */
  readonly value?: string
  /** The initial draft (uncontrolled: the Textarea owns its value, writes are undoable). */
  readonly defaultValue?: string
  /** Every draft change: typing, the clear on send, a restore after a failure, a recall. */
  readonly onValueChange?: (value: string, details: { readonly reason: PromptValueReason }) => void
  /** The attachments (controlled). */
  readonly attachments?: readonly PromptAttachment[]
  /** The initial attachments (uncontrolled). Default none. */
  readonly defaultAttachments?: readonly PromptAttachment[]
  /** Every attachments change: added files, removals, the clear on send, a restore. */
  readonly onAttachmentsChange?: (
    attachments: readonly PromptAttachment[],
    details: { readonly reason: PromptAttachmentsReason },
  ) => void
  /**
   * Sends the prompt: called once per send with the draft and attachments as they were; both
   * clear at once. Return a promise to stay `submitting` until it settles; a rejection
   * restores the prompt into an empty draft. A synchronous throw fails the send and is
   * rethrown to whatever submitted.
   */
  readonly onSubmit?: (message: PromptMessage, details: PromptSubmitDetails) => unknown
  /**
   * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
   * it, `error` fails the send.
   */
  readonly status?: PromptInputStatus
  /** Submit was pressed while a reply is on its way. */
  readonly onStop?: () => void
  /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
  readonly onReject?: (rejections: readonly FileRejection[]) => void
  /**
   * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
   * `"none"` (only Submit). Mod+Enter always sends; with a coarse primary pointer (phones,
   * tablets) Enter is a newline. Default `"enter"`.
   */
  readonly submitKey?: PromptSubmitKey
  /** Past prompts, newest last: ArrowUp in an empty draft recalls them. */
  readonly history?: readonly string[]
  /** Accepted files, as `<input accept>`: MIME types, `type/*` and `.ext`. */
  readonly accept?: string
  /** The file chooser picks several files. Default `true`. */
  readonly multiple?: boolean
  /** The most attachments at once; more are refused. */
  readonly maxFiles?: number
  /** The largest file, in bytes; larger ones are refused. */
  readonly maxFileSize?: number
  /** The Textarea's form name. Default `"message"`. */
  readonly name?: string
  /** The attached files' form name. Default `"files"`. */
  readonly filesName?: string
  /** Disables every part: typing, sending, files. */
  readonly disabled?: boolean
  /** No typing and no files; the draft can still be sent. */
  readonly readOnly?: boolean
  /** The Field is invalid (also while over a CharacterCount's max). */
  readonly invalid?: boolean
  /** The Field's error messages (PromptInput.ErrorMessage shows them). */
  readonly errors?: readonly string[]
  /** Replaces any string that reaches assistive technology. */
  readonly messages?: Partial<PromptInputMessages>
  /** Replaces the Field's own strings. */
  readonly fieldMessages?: MessageOverrides<FieldMessages>
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
  readonly api: PromptInputApi
  readonly ids: ReturnType<typeof promptInputIds>
  readonly value: string
  readonly controlled: boolean
  readonly defaultValue: string
  readonly attachments: readonly PromptAttachment[]
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly name: string
  readonly control: PromptInputControl
  readonly setCount: (c: CountState | null) => void
  readonly count: { readonly used: number; readonly max: number | undefined } | null
  readonly setTextareaId: (id: string) => void
  readonly textarea: RefObject<HTMLTextAreaElement | null>
  readonly mounted: RefObject<{ textareas: number; submits: number }>
  readonly takeReason: () => PromptValueReason | undefined
}

const HostContext = createContext<Host | null>(null)
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
const noSubscription = () => () => {}

function Root(all: PromptInputRootProps) {
  const {
    id,
    children,
    render,
    value: _value,
    defaultValue = "",
    onValueChange: _onValueChange,
    attachments: _attachments,
    defaultAttachments,
    onAttachmentsChange: _onAttachmentsChange,
    onSubmit: _onSubmit,
    status,
    onStop: _onStop,
    onReject: _onReject,
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
  } = all
  const env = useEnvironment()
  const instance = useRootId(id)
  const ids = useMemo(() => promptInputIds(instance), [instance])
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = ownDisabled || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = ownReadOnly || enclosing?.state.readOnly === true
  const locale = env.locale.locale()
  const messages = useMemo(() => ({ ...promptInputMessages, ...overrides }), [overrides])
  const latest = useRef(all)
  latest.current = all
  const controlled = all.value !== undefined
  const [countState, setCount] = useState<CountState | null>(null)
  const [textareaId, setTextareaId] = useState(ids.textarea)
  const [focusedButton, setFocusedButton] = useState<"submit" | "attach-trigger" | null>(null)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const mounted = useRef({ textareas: 0, submits: 0 })
  const reason = useRef<PromptValueReason | undefined>(undefined)
  const thrown = useRef<{ readonly error: unknown } | null>(null)
  const props = {
    ...(controlled ? { value: all.value ?? "" } : {}),
    defaultValue,
    ...("attachments" in all ? { attachments: all.attachments ?? EMPTY } : {}),
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
    locale,
    messages,
    onSubmit: (m: PromptMessage, d: PromptSubmitDetails) => latest.current.onSubmit?.(m, d),
    onStop: () => latest.current.onStop?.(),
    onReject: (r: readonly FileRejection[]) => latest.current.onReject?.(r),
    onThrow: (error: unknown) => {
      thrown.current = { error }
    },
    // Uncontrolled: an undoable edit of the Textarea; its `input` event brings the value back.
    writeDraft: controlled
      ? undefined
      : (text: string, why: PromptValueReason) => {
          const el = textarea.current
          if (!el) return false
          reason.current = why
          try {
            return replaceText(el, text)
          } finally {
            reason.current = undefined
          }
        },
    onValueChange: (v: string, d: { event: { type: string } }) =>
      latest.current.onValueChange?.(v, { reason: promptValueReason(d.event) }),
    onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) =>
      latest.current.onAttachmentsChange?.(v, { reason: promptAttachmentsReason(d.event) }),
  }
  // Sound: `props` is the machine's props (the React-only ones are split off above).
  const { service } = useMachine(promptInputMachine, props as never, env as never)
  const view = service.view()
  const value = (view.values.value as string | undefined) ?? ""
  const attachments = (view.values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY
  const context = view.context
  // The modality tracker must see the pointerdown that comes before a focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const modality = useModality(env.modality, context.focused || focusedButton !== null)
  // Server and hydration: a fine pointer; the client's own after hydration.
  const touchPrimary = useSyncExternalStore(
    env.pointer?.subscribeCoarse ?? noSubscription,
    () => env.pointer?.coarse() ?? false,
    () => false,
  )
  const api = promptInputConnect(
    {
      instance,
      state: view.state as PromptInputState,
      context,
      value,
      attachments,
      props: { disabled, readOnly, history, limit: countState?.max, count: countState?.count },
      submitKey,
      touchPrimary,
      accept,
      multiple,
      name,
      filesName,
      textareaId,
      countMounted: countState !== null,
      modality,
      dir: env.locale.dir(),
      locale,
      messages,
      focusedButton,
      setFocusedButton,
      nativeAction: form.action !== undefined,
      takeThrown: () => {
        const t = thrown.current
        thrown.current = null
        return t
      },
      takeReason: () => reason.current,
      send: service.send,
    },
    env,
  )
  // The carrier input holds the attached files, so the form's FormData carries them.
  useIsoLayoutEffect(() => {
    const el = env.dom.getById(ids.files)
    if (!(el instanceof HTMLInputElement)) return
    const files = attachments.flatMap((a) => (a.file ? [a.file] : []))
    if (files.length > 0 || (el.files?.length ?? 0) > 0) syncFileInput(el, files)
  }, [attachments, env, ids.files])
  // Exactly one Textarea and one Submit (development error otherwise).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const { textareas, submits } = mounted.current
    if (textareas !== 1 || submits !== 1) {
      console.error(
        `[rind-ui] prompt-input: renders ${textareas} Textarea and ${submits} Submit parts; exactly one of each is required.`,
      )
    }
  }, [])
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
    control: { ...api.control, state: view.state as PromptInputState, value, attachments },
    setCount,
    count: countState ? { used: api.derived.used, max: countState.max } : null,
    setTextareaId,
    textarea,
    mounted,
    takeReason: () => reason.current,
  }
  return (
    <HostContext value={host}>
      {renderPart(
        "form",
        {
          ...mergeProps(normalizeProps(api.root()), form),
          children: (
            <>
              <FieldHost
                scope="prompt-input"
                rootPart="field"
                id={`${instance}-field`}
                disabled={disabled}
                readOnly={readOnly}
                invalid={invalid === true || api.derived.overLimit}
                {...(errors ? { errors } : {})}
                {...(fieldMessages ? { messages: fieldMessages } : {})}
              >
                {children}
              </FieldHost>
              <span {...normalizeProps(api.chipsSummary())}>{api.summaryText}</span>
              <input {...normalizeProps(api.picker())} />
              <input {...normalizeProps(api.files())} />
            </>
          ),
        },
        render,
        undefined,
      )}
    </HostContext>
  )
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Substitutes the rendered element. */
  readonly render?: RenderProp<undefined>
}

/** Counts a part for the "exactly one" development check. */
function useCounted(host: Host, key: "textareas" | "submits") {
  const { mounted } = host
  useIsoLayoutEffect(() => {
    mounted.current[key] += 1
    return () => {
      mounted.current[key] -= 1
    }
  }, [mounted, key])
}

function Textarea({
  render,
  autosize = true,
  ref,
  id,
  ...rest
}: Omit<Own<"textarea">, "value" | "defaultValue"> & {
  /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
  readonly autosize?: boolean
}) {
  const host = useHost("Textarea")
  useCounted(host, "textareas")
  const env = useEnvironment()
  const binding = useFieldControl()
  const el = useRef<HTMLTextAreaElement | null>(null)
  // The Field's control id first: its Label is `for` it from the first render.
  const controlId = id ?? binding?.controlId ?? host.ids.textarea
  const { setTextareaId, textarea } = host
  useIsoLayoutEffect(() => setTextareaId(controlId), [controlId, setTextareaId])
  useIsoLayoutEffect(() => {
    textarea.current = el.current
    return () => {
      textarea.current = null
    }
  }, [textarea])
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (modality) => {
          if (el.current) void focusSafely(el.current, env, "programmatic", modality)
        },
        validityElement: () => el.current,
        value: () => el.current?.value ?? "",
      },
      controlId,
    )
  }, [register, controlId, env])
  const handle = useRef<ReturnType<typeof attachAutosize> | null>(null)
  useIsoLayoutEffect(() => {
    if (!autosize || !el.current) return
    const a = attachAutosize(el.current, env)
    handle.current = a
    return () => {
      a.dispose()
      handle.current = null
    }
  }, [autosize, env])
  // Every value commit (typing, the clear on send, a restore, a recall) re-measures.
  const { value } = host
  useIsoLayoutEffect(() => {
    void value
    handle.current?.measure()
  }, [value])
  // Development: the placeholder is never a name. Checked once the Field's Label settled
  // (its `for` follows the registered control).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const frame = env.scheduler.requestAnimationFrame(() => {
      const node = el.current
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
    return () => env.scheduler.cancelAnimationFrame(frame)
  }, [env])
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled: host.disabled,
      readOnly: host.readOnly,
      invalid: host.api.derived.overLimit,
      name: host.name,
      consumerDescribedBy: rest["aria-describedby"],
      ariaLabel: rest["aria-label"],
      ariaLabelledBy: rest["aria-labelledby"],
    },
    binding,
  )
  const report = binding?.report
  return renderPart(
    "textarea",
    mergeProps(
      normalizeProps({
        ...host.api.textarea(field),
        ...(host.controlled ? { value: host.value } : { defaultValue: host.defaultValue }),
      }),
      {
        ...rest,
        "aria-describedby": undefined,
        ref: composeRefs(el, ref),
        // The Field validates on the control's changes.
        onChange: (e: { target: HTMLTextAreaElement; nativeEvent: Event }) =>
          report?.({
            type: "change",
            value: e.target.value,
            user: true,
            composing: (e.nativeEvent as InputEvent).isComposing === true,
          }),
      },
    ),
    render,
    undefined,
  )
}

function Submit({ render, children, ...rest }: Own<"button">) {
  const host = useHost("Submit")
  useCounted(host, "submits")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.submit()), { ...rest, children }),
    render,
    undefined,
  )
}

function AttachTrigger({ render, ...rest }: Own<"button">) {
  const host = useHost("AttachTrigger")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.attachTrigger()), rest),
    render,
    undefined,
  )
}

const ChipCtx = createContext<{
  readonly key: string
  readonly attachment: PromptAttachment
} | null>(null)

/** The attachments toolbar: one Attachment per file. Renders nothing while empty. */
function Attachments({
  render,
  children,
  ...rest
}: Omit<Own<"div">, "children"> & {
  /** Renders one attachment; default: its name and its remove button. */
  readonly children?: (attachment: PromptAttachment) => ReactNode
}) {
  const host = useHost("Attachments")
  if (host.attachments.length === 0) return null
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(host.api.chipsPart()), rest),
      children: host.attachments.map((attachment) => (
        <ChipCtx key={attachment.id} value={{ key: attachment.id, attachment }}>
          {children ? (
            children(attachment)
          ) : (
            <Attachment>
              <AttachmentName />
              <AttachmentRemove />
            </Attachment>
          )}
        </ChipCtx>
      )),
    },
    render,
    undefined,
  )
}

const useChip = (part: string) => {
  const c = useContext(ChipCtx)
  if (c === null) throw new Error(`PromptInput.${part} must be inside PromptInput.Attachments`)
  return c
}

function Attachment({ render, ...rest }: Own<"span">) {
  const host = useHost("Attachment")
  const { key } = useChip("Attachment")
  return renderPart("span", mergeProps(normalizeProps(host.api.chip(key)), rest), render, undefined)
}

function AttachmentName({ render, children, ...rest }: Own<"span">) {
  const host = useHost("AttachmentName")
  const { attachment } = useChip("AttachmentName")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.api.chipText()), {
      ...rest,
      children: children ?? attachment.name,
    }),
    render,
    undefined,
  )
}

function AttachmentRemove({ render, children, ...rest }: Own<"button">) {
  const host = useHost("AttachmentRemove")
  const { key } = useChip("AttachmentRemove")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.chipRemove(key)), {
      ...rest,
      children: children ?? <span aria-hidden="true">×</span>,
    }),
    render,
    undefined,
  )
}

function CharacterCount({
  render,
  max,
  count,
  children,
  ...rest
}: Own<"span"> & {
  /** A soft limit: over it, nothing is sent and the input is invalid; never a truncation. */
  readonly max?: number
  /** Counts the draft (a tokenizer for a token limit). Default: characters, a line break once. */
  readonly count?: (value: string) => number
}) {
  const host = useHost("CharacterCount")
  const { setCount } = host
  useIsoLayoutEffect(() => {
    setCount({ max, count })
    return () => setCount(null)
  }, [setCount, max, count])
  // Frozen at the committed draft while a composition is open (core's derivation).
  const used = host.count?.used ?? 0
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.api.characterCount()), {
      ...rest,
      children: children ?? (max === undefined ? `${used}` : `${used}/${max}`),
    }),
    render,
    undefined,
  )
}

export const PromptInput = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Textarea,
  Submit,
  AttachTrigger,
  Attachments,
  Attachment,
  AttachmentName,
  AttachmentRemove,
  CharacterCount,
}
