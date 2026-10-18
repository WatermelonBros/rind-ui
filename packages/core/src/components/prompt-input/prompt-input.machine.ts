// Prompt Input (design §1): the request lifecycle `idle | composing | submitting | streaming |
// stopped`. The request is the consumer's: `onSubmit` may return a promise and `status`
// reports progress; the machine never knows about a model. One guard (`submittable`) decides
// every submit path. Attachments are `input-chips`; files enter through one action.

import type { Modality } from "../../contract/env"
import { type FileRejection, validateFiles } from "../../dom/file-intake"
import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  type Chip,
  type InputChipsContext,
  type InputChipsEvent,
  initialInputChipsContext,
  inputChipsActions,
  lastRemovable,
} from "../input-chips/input-chips"
import { countAnnouncement, defaultCount } from "../text-field/text-field.machine"
import { textFieldMessages } from "../text-field/text-field.messages"
import type { PromptInputMessages } from "./prompt-input.messages"

/** One attached file (or a consumer item without a `File`, e.g. an uploaded document). */
export interface PromptAttachment {
  /** Unique within the input. */
  readonly id: string
  /** Shown and announced; names the chip. */
  readonly name: string
  readonly file?: File | undefined
  /** MIME type. */
  readonly type?: string | undefined
  /** Bytes. */
  readonly size?: number | undefined
  /** Still uploading: the input is not submittable while any attachment is pending. */
  readonly pending?: boolean | undefined
  /** The user cannot remove it. */
  readonly disabled?: boolean | undefined
}

/** The request status the consumer reports (the AI SDK's ready/submitted/streaming/error). */
export type PromptInputStatus = "idle" | "submitting" | "streaming" | "error"

/** What one submit sends: the draft and the attachments as they were at submit time. */
export interface PromptMessage {
  readonly text: string
  readonly attachments: readonly PromptAttachment[]
}

export interface PromptSubmitDetails {
  /** The native `submit` event (null for a programmatic submit without a form). */
  readonly event: Event | null
  /** The form's data: the text under the Textarea's name, the files under the file input's. */
  readonly formData: FormData | null
}

/** Which keys submit from the Textarea. */
export type PromptSubmitKey = "enter" | "mod+enter" | "none"

export type PromptInputEvent =
  | InputChipsEvent
  | { readonly type: "INPUT"; readonly value: string; readonly composing: boolean }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly value: string }
  | { readonly type: "FOCUS"; readonly modality: Modality }
  | { readonly type: "BLUR" }
  /** Any caret move or press in the Textarea: disarms an armed attachment. */
  | { readonly type: "CARET" }
  | {
      readonly type: "SUBMIT"
      readonly event: Event | null
      readonly formData: FormData | null
    }
  /** Submit pressed while busy; `clickCount` is the click's `detail` (0 for keys and AT). */
  | { readonly type: "STOP"; readonly clickCount: number }
  /** The `status` prop changed. */
  | { readonly type: "STATUS" }
  /** The promise `onSubmit` returned settled (by submit token). */
  | { readonly type: "SETTLED"; readonly token: number; readonly ok: boolean }
  /** A stop with nothing to wait for. */
  | { readonly type: "STOP.SETTLE" }
  | {
      readonly type: "FILES.ADD"
      readonly files: readonly File[]
      readonly via: "picker" | "paste" | "drop" | "api"
    }
  | { readonly type: "DRAG.ENTER" }
  | { readonly type: "DRAG.LEAVE" }
  | { readonly type: "RECALL"; readonly direction: "older" | "newer" }
  /** A programmatic draft change (`api.setValue`, a suggestion). */
  | { readonly type: "SET.VALUE"; readonly value: string }

export interface PromptInputProps {
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<PromptInputEvent>) => void)
    | undefined
  readonly attachments?: readonly PromptAttachment[] | undefined
  readonly defaultAttachments?: readonly PromptAttachment[] | undefined
  readonly onAttachmentsChange?:
    | ((attachments: readonly PromptAttachment[], details: ChangeDetails<PromptInputEvent>) => void)
    | undefined
  readonly status?: PromptInputStatus | undefined
  readonly onSubmit?:
    | ((message: PromptMessage, details: PromptSubmitDetails) => unknown)
    | undefined
  readonly onStop?: (() => void) | undefined
  readonly onReject?: ((rejections: readonly FileRejection[]) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly history?: readonly string[] | undefined
  readonly accept?: string | undefined
  readonly maxFiles?: number | undefined
  readonly maxFileSize?: number | undefined
  /** A CharacterCount's `max` (soft limit). */
  readonly limit?: number | undefined
  readonly count?: ((value: string) => number) | undefined
  readonly threshold?: number | undefined
  readonly id: string
  readonly locale: string
  readonly messages: PromptInputMessages
}

export interface PromptInputContext extends InputChipsContext {
  readonly focused: boolean
  readonly composing: boolean
  readonly dragging: boolean
  /** The current submit; a settle of an older one is ignored. */
  readonly token: number
  /** The promise of the current submit has not settled. */
  readonly pending: boolean
  readonly snapshot: PromptMessage | null
  /** Index into `history` of the recalled entry, or null. */
  readonly historyIndex: number | null
  /** The draft before recalling. */
  readonly savedDraft: string
  readonly nextId: number
}

type Types = {
  props: PromptInputProps
  events: PromptInputEvent
  env: AnnouncerEnv
  context: PromptInputContext
  values: "value" | "attachments"
}
type Args = ActionArgs<Types>

const NONE: readonly PromptAttachment[] = []

/** The chips of the attachments. */
export const attachmentChips = (
  attachments: readonly PromptAttachment[],
  locked: boolean,
): readonly Chip[] =>
  attachments.map((a) => ({ key: a.id, text: a.name, disabled: locked || a.disabled === true }))

const attachmentsOf = (a: { readonly values: { readonly attachments: unknown } }) =>
  (a.values.attachments as readonly PromptAttachment[] | undefined) ?? NONE
const interactive = (p: PromptInputProps) => p.disabled !== true && p.readOnly !== true

/** Over a CharacterCount's `max`. */
export const isOverLimit = (p: Pick<PromptInputProps, "limit" | "count">, value: string) =>
  p.limit !== undefined && (p.count ?? defaultCount)(value) > p.limit

/** The one guard every submit path asks (spec "Submittable"), apart from the state. */
export function isSubmittable(
  p: PromptInputProps,
  value: string,
  attachments: readonly PromptAttachment[],
  composing: boolean,
): boolean {
  return (
    p.disabled !== true &&
    !composing &&
    (value.trim() !== "" || attachments.length > 0) &&
    !attachments.some((a) => a.pending === true) &&
    !isOverLimit(p, value)
  )
}

const announce = (a: Args, message: string, assertive = false, key?: string) =>
  a.env.announcer.announce({
    message,
    priority: assertive ? "assertive" : "polite",
    ...(key ? { key: `prompt-input-${a.props.id}-${key}` } : {}),
  })

const chipsOf = (a: Pick<Args, "props" | "values">) =>
  attachmentChips(attachmentsOf(a), !interactive(a.props))

function removeAttachment(a: Args, id: string) {
  const list = attachmentsOf(a)
  const gone = list.find((x) => x.id === id)
  if (!gone) return
  a.set(
    "attachments",
    list.filter((x) => x.id !== id),
  )
  announce(a, a.props.messages.removedAnnouncement(gone.name), false, "removed")
}

const statusIs =
  (...s: readonly (PromptInputStatus | undefined)[]) =>
  ({ props }: { readonly props: Readonly<PromptInputProps> }): boolean =>
    s.includes(props.status)

export const promptInputMachine = setup({
  types: type<Types>(),
  guards: {
    submittable: ({ props, values, context }) =>
      isSubmittable(props, values.value, attachmentsOf({ values }), context.composing),
    commits: ({ event }) => event.type === "INPUT" && !event.composing,
    clickOnce: ({ event }) => event.type === "STOP" && event.clickCount <= 1,
    currentToken: ({ event, context }) => event.type === "SETTLED" && event.token === context.token,
    settledOk: ({ event }) => event.type === "SETTLED" && event.ok,
    /** The consumer does not drive `status` past this point: a resolved promise ends it. */
    notStreaming: ({ props }) => props.status !== "streaming" && props.status !== "submitting",
    statusSubmitting: statusIs("submitting"),
    statusStreaming: statusIs("streaming"),
    statusIdle: statusIs("idle", undefined),
    statusError: statusIs("error"),
    canAttach: ({ props }) => interactive(props),
    chipRemovable: ({ event, props, values }) =>
      event.type === "CHIP.REMOVE" &&
      interactive(props) &&
      chipsOf({ props, values }).some((c) => c.key === event.key && !c.disabled),
    armedRemovable: ({ context, props }) => context.armedChip !== null && interactive(props),
    armsOnBackspace: ({ props, values }) =>
      interactive(props) && lastRemovable(chipsOf({ props, values })) !== null,
    canRecall: ({ event, props, values, context }) => {
      const history = props.history ?? []
      if (event.type !== "RECALL" || history.length === 0 || context.composing) return false
      if (event.direction === "newer") return context.historyIndex !== null
      if (context.historyIndex === null) return values.value === ""
      return values.value === history[context.historyIndex] && context.historyIndex > 0
    },
    editable: ({ props }) => interactive(props),
  },
  actions: {
    ...inputChipsActions,
    setFocused: ({ set }) => set("focused", true),
    blurred: ({ set }) => {
      set("focused", false)
      // A composition that never ended (dead keys, assistant-ui#3923) ends here.
      set("composing", false)
      set("armedChip", null)
    },
    startComposing: ({ set }) => set("composing", true),
    endComposing: ({ set }) => set("composing", false),
    setValue: (a) => {
      const e = a.event
      if (e.type !== "INPUT" && e.type !== "COMPOSITION.END" && e.type !== "SET.VALUE") return
      if (e.type === "INPUT" && !e.composing) a.set("composing", false)
      a.set("armedChip", null)
      if (e.value !== a.values.value) a.set("value", e.value)
      // Typing leaves the recalled entry (it is now the user's draft).
      if (a.context.historyIndex !== null) {
        const entry = a.props.history?.[a.context.historyIndex]
        if (entry !== e.value) a.set("historyIndex", null)
      }
    },
    /** Near and over the limit, focused, not composing: keyed, so a pause speaks once. */
    announceCount: (a) => {
      if (!a.context.focused || a.context.composing) return
      const m = a.props.messages
      const message = countAnnouncement(a.values.value, {
        limit: a.props.limit,
        threshold: a.props.threshold,
        count: a.props.count,
        messages: {
          ...textFieldMessages,
          charactersRemaining: m.charactersRemaining,
          charactersOver: m.charactersOver,
        },
      })
      if (message) announce(a, message, false, "count")
    },
    submit: (a) => {
      if (a.event.type !== "SUBMIT") return
      const text = a.values.value
      const attachments = attachmentsOf(a)
      const token = a.context.token + 1
      a.set("token", token)
      a.set("snapshot", { text, attachments })
      a.set("historyIndex", null)
      a.set("armedChip", null)
      // Cleared now: what the user types while the request is pending is the next prompt.
      a.set("value", "")
      if (attachments.length > 0) a.set("attachments", NONE)
      const details = { event: a.event.event, formData: a.event.formData }
      let result: unknown
      try {
        result = a.props.onSubmit?.({ text, attachments }, details)
      } catch (error) {
        a.send({ type: "SETTLED", token, ok: false })
        // Not swallowed: surfaces as an unhandled rejection, like the throw it was.
        void Promise.reject(error)
        return
      }
      if (
        typeof result === "object" &&
        result !== null &&
        typeof (result as PromiseLike<unknown>).then === "function"
      ) {
        a.set("pending", true)
        ;(result as PromiseLike<unknown>).then(
          () => a.send({ type: "SETTLED", token, ok: true }),
          () => a.send({ type: "SETTLED", token, ok: false }),
        )
      } else if (a.props.status === undefined) {
        a.send({ type: "SETTLED", token, ok: true })
      }
    },
    settled: ({ set }) => set("pending", false),
    /** A failed send: announce; restore into an empty draft only (spec "Failed Send"). */
    failSend: (a) => {
      announce(a, a.props.messages.sendFailedAnnouncement, true)
      const snap = a.context.snapshot
      if (!snap || a.values.value !== "" || attachmentsOf(a).length > 0) return
      if (snap.text !== "") a.set("value", snap.text)
      if (snap.attachments.length > 0) a.set("attachments", snap.attachments)
    },
    announceFailure: (a) => announce(a, a.props.messages.sendFailedAnnouncement, true),
    callOnStop: (a) => a.props.onStop?.(),
    announceStopped: (a) => announce(a, a.props.messages.stoppedAnnouncement),
    /** Nothing reports the end of a stopped request: idle at once. */
    settleStop: (a) => {
      if (a.props.status === undefined && !a.context.pending) a.send({ type: "STOP.SETTLE" })
    },
    /** The initial `status` decides the first state (assistant-ui#4505: idle by default). */
    initialStatus: (a) => {
      if (a.event.type !== "$start") return
      if (a.props.status === "submitting" || a.props.status === "streaming") {
        a.send({ type: "STATUS" })
      }
    },
    addFiles: (a) => {
      if (a.event.type !== "FILES.ADD") return
      a.set("dragging", false)
      const { props } = a
      const list = attachmentsOf(a)
      const { accepted, rejected } = validateFiles(a.event.files, {
        accept: props.accept,
        maxFiles: props.maxFiles,
        maxFileSize: props.maxFileSize,
        current: list.length,
      })
      if (accepted.length > 0) {
        let n = a.context.nextId
        const added = accepted.map((file) => ({
          id: `${props.id}-file-${n++}`,
          name: file.name,
          file,
          type: file.type,
          size: file.size,
        }))
        a.set("nextId", n)
        a.set("attachments", [...list, ...added])
        announce(
          a,
          added.length === 1
            ? props.messages.attachedAnnouncement(added[0]?.name ?? "")
            : props.messages.attachedCountAnnouncement(added.length, props.locale),
          false,
          "attached",
        )
      }
      if (rejected.length > 0) {
        props.onReject?.(rejected)
        const first = rejected[0]
        announce(
          a,
          rejected.length === 1 && first
            ? props.messages.rejectedAnnouncement(first.file.name, first.reason)
            : props.messages.rejectedCountAnnouncement(rejected.length, props.locale),
          true,
        )
      }
    },
    dragOn: ({ set }) => set("dragging", true),
    dragOff: ({ set }) => set("dragging", false),
    removeChip: (a) => {
      if (a.event.type === "CHIP.REMOVE") removeAttachment(a, a.event.key)
    },
    arm: (a) => a.set("armedChip", lastRemovable(chipsOf(a))),
    removeArmed: (a) => {
      const key = a.context.armedChip
      a.set("armedChip", null)
      if (key !== null) removeAttachment(a, key)
    },
    chipType: (a) => {
      if (a.event.type !== "CHIP.TYPE") return
      a.set("value", a.values.value + a.event.text)
      a.set("armedChip", null)
    },
    recall: (a) => {
      if (a.event.type !== "RECALL") return
      const history = a.props.history ?? []
      const at = a.context.historyIndex
      if (a.event.direction === "older") {
        if (at === null) a.set("savedDraft", a.values.value)
        const next = at === null ? history.length - 1 : at - 1
        a.set("historyIndex", next)
        a.set("value", history[next] ?? "")
        return
      }
      if (at === null) return
      const next = at + 1
      if (next >= history.length) {
        a.set("historyIndex", null)
        a.set("value", a.context.savedDraft)
      } else {
        a.set("historyIndex", next)
        a.set("value", history[next] ?? "")
      }
    },
  },
}).machine({
  id: "prompt-input",
  initial: "idle",
  context: () => ({
    ...initialInputChipsContext(),
    focused: false,
    composing: false,
    dragging: false,
    token: 0,
    pending: false,
    snapshot: null,
    historyIndex: null,
    savedDraft: "",
    nextId: 0,
  }),
  values: {
    value: { fallback: "" },
    attachments: { fallback: NONE as PromptAttachment[] },
  },
  onProps: { status: "STATUS" },
  on: {
    INPUT: { actions: ["setValue", "announceCount"] },
    "SET.VALUE": { actions: ["setValue"] },
    "COMPOSITION.START": { actions: ["startComposing"] },
    "COMPOSITION.END": { actions: ["endComposing", "setValue", "announceCount"] },
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["blurred", "blurChip"] },
    CARET: { actions: ["disarm"] },
    "FILES.ADD": { guard: "canAttach", actions: ["addFiles"] },
    "DRAG.ENTER": { guard: "canAttach", actions: ["dragOn"] },
    "DRAG.LEAVE": { actions: ["dragOff"] },
    "CHIP.NAVIGATE": { actions: ["setFocused", "focusChip"] },
    "CHIP.BLUR": { actions: ["blurChip"] },
    "CHIP.REMOVE": { guard: "chipRemovable", actions: ["removeChip"] },
    "CHIP.TYPE": { guard: "editable", actions: ["chipType"] },
    BACKSPACE_EMPTY: [
      { guard: "armedRemovable", actions: ["removeArmed"] },
      { guard: "armsOnBackspace", actions: ["arm"] },
    ],
    RECALL: { guard: "canRecall", actions: ["recall"] },
    // A stale or late settle: only clears the pending flag.
    SETTLED: { guard: "currentToken", actions: ["settled"] },
  },
  states: {
    idle: {
      entry: ["initialStatus"],
      on: {
        "COMPOSITION.START": { target: "composing", actions: ["startComposing"] },
        SUBMIT: { guard: "submittable", target: "submitting", actions: ["submit"] },
        STATUS: [
          { guard: "statusSubmitting", target: "submitting" },
          { guard: "statusStreaming", target: "streaming" },
        ],
      },
    },
    composing: {
      on: {
        "COMPOSITION.END": {
          target: "idle",
          actions: ["endComposing", "setValue", "announceCount"],
        },
        // A composition that never ended: the next plain input or a blur ends it.
        INPUT: { guard: "commits", target: "idle", actions: ["setValue", "announceCount"] },
        BLUR: { target: "idle", actions: ["blurred", "blurChip"] },
      },
    },
    submitting: {
      on: {
        STATUS: [
          { guard: "statusStreaming", target: "streaming" },
          { guard: "statusError", target: "idle", actions: ["failSend"] },
          { guard: "statusIdle", target: "idle" },
        ],
        SETTLED: [
          {
            guard: { and: ["currentToken", "settledOk", "notStreaming"] },
            target: "idle",
            actions: ["settled"],
          },
          {
            guard: { and: ["currentToken", { not: "settledOk" }] },
            target: "idle",
            actions: ["settled", "failSend"],
          },
          { guard: "currentToken", actions: ["settled"] },
        ],
        STOP: {
          guard: "clickOnce",
          target: "stopped",
          actions: ["callOnStop", "announceStopped"],
        },
      },
    },
    streaming: {
      on: {
        STATUS: [
          { guard: "statusError", target: "idle", actions: ["announceFailure"] },
          { guard: "statusIdle", target: "idle" },
        ],
        SETTLED: [
          {
            guard: { and: ["currentToken", "settledOk", "notStreaming"] },
            target: "idle",
            actions: ["settled"],
          },
          {
            guard: { and: ["currentToken", { not: "settledOk" }] },
            target: "idle",
            actions: ["settled", "announceFailure"],
          },
          { guard: "currentToken", actions: ["settled"] },
        ],
        STOP: {
          guard: "clickOnce",
          target: "stopped",
          actions: ["callOnStop", "announceStopped"],
        },
      },
    },
    stopped: {
      entry: ["settleStop"],
      on: {
        STATUS: [
          { guard: "statusIdle", target: "idle" },
          { guard: "statusError", target: "idle" },
        ],
        SETTLED: { guard: "currentToken", target: "idle", actions: ["settled"] },
        "STOP.SETTLE": "idle",
      },
    },
  },
})
export type PromptInputMachine = typeof promptInputMachine
