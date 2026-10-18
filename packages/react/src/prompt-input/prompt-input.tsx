// Prompt Input (prompt-input spec): Root owns the machine and renders the form, the hidden
// file inputs and the attachments summary; every other part is wiring.

import {
  autosize as attachAutosize,
  attachmentChips,
  type Chip as ChipData,
  defaultCount,
  type FileRejection,
  isOverLimit,
  isSubmittable,
  type PromptAttachment,
  type PromptInputApi,
  type PromptInputMessages,
  type PromptInputStatus,
  type PromptMessage,
  type PromptSubmitDetails,
  type PromptSubmitKey,
  promptInputConnect,
  promptInputIds,
  promptInputMachine,
  promptInputMessages,
  syncFileInput,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** Why the draft changed. */
export type PromptValueReason = "input" | "submit" | "restore" | "history" | "api"
/** Why the attachments changed. */
export type PromptAttachmentsReason = "add" | "remove" | "submit" | "restore"

const valueReason = (type: string): PromptValueReason =>
  type === "SUBMIT"
    ? "submit"
    : type === "SETTLED" || type === "STATUS"
      ? "restore"
      : type === "RECALL"
        ? "history"
        : type === "SET.VALUE"
          ? "api"
          : "input"
const attachmentsReason = (type: string): PromptAttachmentsReason =>
  type === "FILES.ADD"
    ? "add"
    : type === "SUBMIT"
      ? "submit"
      : type === "SETTLED" || type === "STATUS"
        ? "restore"
        : "remove"

export interface PromptInputRootProps
  extends Omit<ComponentPropsWithRef<"form">, "onSubmit" | "defaultValue" | "children"> {
  readonly children?: ReactNode
  /** Substitutes the `<form>` element. */
  readonly render?: RenderProp<undefined>
  /** The draft (controlled). */
  readonly value?: string
  /** The initial draft (uncontrolled). Default `""`. */
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
   * restores the prompt into an empty draft.
   */
  readonly onSubmit?: (message: PromptMessage, details: PromptSubmitDetails) => unknown
  /**
   * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
   * it, `error` fails the send. Pass it when your chat state reports a status.
   */
  readonly status?: PromptInputStatus
  /** Submit was pressed while a reply is on its way. */
  readonly onStop?: () => void
  /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
  readonly onReject?: (rejections: readonly FileRejection[]) => void
  /**
   * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
   * `"none"` (only Submit). Mod+Enter always sends; on phones and tablets Enter is a
   * newline. Default `"enter"`.
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
  /** Replaces any string that reaches assistive technology. */
  readonly messages?: Partial<PromptInputMessages>
}

interface Host {
  readonly api: PromptInputApi
  readonly chips: readonly ChipData[]
  readonly value: string
  readonly state: string
  readonly attachments: readonly PromptAttachment[]
  readonly control: PromptInputControl
  readonly setCount: (c: CountState | null) => void
  readonly count: { readonly used: number; readonly limit: number | undefined } | null
  readonly mount: (part: "label" | "description", on: boolean) => void
  readonly labelled: boolean
}

interface CountState {
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

/** What `usePromptInput()` returns: the state and the actions a suggestion or a menu uses. */
export interface PromptInputControl {
  /** `idle`, `composing`, `submitting`, `streaming` or `stopped`. */
  readonly state: string
  readonly value: string
  readonly attachments: readonly PromptAttachment[]
  /** Sends the draft, through the same checks as Enter. */
  submit(): void
  /** Stops the reply (as Submit does while busy). */
  stop(): void
  /** Replaces the draft (reason `api`). */
  setValue(value: string): void
  /** Inserts text at the caret (or replaces the selection). */
  insertText(text: string): void
  /** Focuses the Textarea. */
  focus(): void
  /** Opens the file chooser. */
  openFilePicker(): void
  /** Adds files, through the same checks as a drop. */
  addFiles(files: readonly File[]): void
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

function Root(all: PromptInputRootProps) {
  const {
    id,
    children,
    render,
    value: _value,
    defaultValue,
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
    disabled = false,
    readOnly = false,
    messages: overrides,
    ...form
  } = all
  const env = useEnvironment()
  const instance = useRootId(id)
  const ids = useMemo(() => promptInputIds(instance), [instance])
  const locale = env.locale.locale()
  const messages = useMemo(() => ({ ...promptInputMessages, ...overrides }), [overrides])
  const latest = useRef(all)
  latest.current = all
  const [countState, setCount] = useState<CountState | null>(null)
  const [mounted, setMounted] = useState({ label: false, description: false })
  const [mount] = useState(
    () => (part: "label" | "description", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const props = {
    ...("value" in all ? { value: all.value ?? "" } : {}),
    defaultValue: defaultValue ?? "",
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
    onValueChange: (v: string, d: { event: { type: string } }) =>
      latest.current.onValueChange?.(v, { reason: valueReason(d.event.type) }),
    onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) =>
      latest.current.onAttachmentsChange?.(v, { reason: attachmentsReason(d.event.type) }),
  }
  const { service } = useMachine(promptInputMachine, props as never, env as never)
  const view = service.view()
  const value = (view.values.value as string | undefined) ?? ""
  const attachments = (view.values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY
  const context = view.context
  const chips = attachmentChips(attachments, disabled || readOnly)
  const [focusedButton, setFocusedButton] = useState<"submit" | "attach-trigger" | null>(null)
  // The modality tracker must see the pointerdown that comes before a focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const modality = useModality(env.modality, context.focused || focusedButton !== null)
  // platform-convention: on phones and tablets Enter is a newline (the on-screen keyboard)
  const touch = env.platform.ios || env.platform.android
  const count = countState
    ? { used: (countState.count ?? defaultCount)(value), limit: countState.max }
    : null
  const historyList = history ?? []
  const at = context.historyIndex
  const api = promptInputConnect(
    {
      instance,
      state: view.state as never,
      context,
      value,
      attachments,
      chips,
      disabled,
      readOnly,
      submittable: isSubmittable(props as never, value, attachments, context.composing),
      overLimit: isOverLimit(props, value),
      submitKey,
      enterSubmits: submitKey === "enter" && !touch,
      recall: {
        older:
          historyList.length > 0 &&
          (at === null ? value === "" : at > 0 && historyList[at] === value),
        newer: at !== null,
        browsing: at !== null && historyList[at] === value,
      },
      accept,
      multiple,
      name,
      filesName,
      count,
      mounted,
      modality,
      dir: env.locale.dir(),
      locale,
      messages,
      focusedButton,
      setFocusedButton,
      nativeAction: form.action !== undefined,
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
  const focusTextarea = () => (env.dom.getById(ids.textarea) as HTMLElement | null)?.focus()
  const control: PromptInputControl = {
    state: view.state,
    value,
    attachments,
    submit: api.requestSubmit,
    stop: () => service.send({ type: "STOP", clickCount: 0 }),
    setValue: (v) => service.send({ type: "SET.VALUE", value: v }),
    insertText: (text) => {
      const el = env.dom.getById(ids.textarea) as HTMLTextAreaElement | null
      const current = service.view().values.value as string
      const start = el?.selectionStart ?? current.length
      const end = el?.selectionEnd ?? start
      service.send({
        type: "SET.VALUE",
        value: current.slice(0, start) + text + current.slice(end),
      })
    },
    focus: focusTextarea,
    openFilePicker: api.openPicker,
    addFiles: (files) => service.send({ type: "FILES.ADD", files, via: "api" }),
  }
  const host: Host = {
    api,
    chips,
    value,
    state: view.state,
    attachments,
    control,
    setCount,
    count,
    mount,
    labelled: mounted.label,
  }
  return (
    <HostContext value={host}>
      {renderPart(
        "form",
        {
          ...mergeProps(normalizeProps(api.root()), form),
          children: (
            <>
              {children}
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

function Label({ render, ...rest }: Own<"label">) {
  const host = useHost("Label")
  const { mount } = host
  useIsoLayoutEffect(() => {
    mount("label", true)
    return () => mount("label", false)
  }, [mount])
  return renderPart("label", mergeProps(normalizeProps(host.api.label()), rest), render, undefined)
}

function Description({ render, ...rest }: Own<"p">) {
  const host = useHost("Description")
  const { mount } = host
  useIsoLayoutEffect(() => {
    mount("description", true)
    return () => mount("description", false)
  }, [mount])
  return renderPart(
    "p",
    mergeProps(normalizeProps(host.api.description()), rest),
    render,
    undefined,
  )
}

function Textarea({
  render,
  autosize = true,
  ref,
  ...rest
}: Own<"textarea"> & {
  /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
  readonly autosize?: boolean
}) {
  const host = useHost("Textarea")
  const env = useEnvironment()
  const el = useRef<HTMLTextAreaElement | null>(null)
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
  const labelled =
    host.labelled || rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !labelled) {
      console.warn(
        "PromptInput.Textarea has no accessible name: render a PromptInput.Label or pass aria-label (a placeholder is not a name).",
      )
    }
  }, [labelled])
  const setRef = (node: HTMLTextAreaElement | null) => {
    el.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }
  return renderPart(
    "textarea",
    mergeProps(normalizeProps(host.api.textarea()), { ...rest, ref: setRef }),
    render,
    undefined,
  )
}

function Submit({ render, children, ...rest }: Own<"button">) {
  const host = useHost("Submit")
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
  readonly chip: ChipData
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
      ...mergeProps(normalizeProps(host.api.chips()), rest),
      children: host.attachments.map((attachment, i) => {
        const chip = host.chips[i] as ChipData // same order and length as attachments
        return (
          <ChipCtx key={attachment.id} value={{ chip, attachment }}>
            {children ? (
              children(attachment)
            ) : (
              <Attachment>
                <AttachmentName />
                <AttachmentRemove />
              </Attachment>
            )}
          </ChipCtx>
        )
      }),
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
  const { chip } = useChip("Attachment")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.api.chip(chip.key)), rest),
    render,
    undefined,
  )
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
  const { chip } = useChip("AttachmentRemove")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.chipRemove(chip.key)), {
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
  Label,
  Description,
  Textarea,
  Submit,
  AttachTrigger,
  Attachments,
  Attachment,
  AttachmentName,
  AttachmentRemove,
  CharacterCount,
}
