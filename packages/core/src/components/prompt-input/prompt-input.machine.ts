// Prompt Input (design §1): the request lifecycle `idle | composing | submitting | streaming |
// stopped`. The request is the consumer's: `onSubmit` may return a promise and `status`
// reports progress; the machine never knows about a model. One guard (`submittable`) decides
// every submit path. Attachments are `input-chips`; files enter through one action. Every
// write of the draft goes through `writeDraft` (an undoable edit in the adapter).

import type { Modality } from "../../contract/env"
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
import { type FileRejection, validateFiles } from "../shared/file-validation"
import { countAnnouncement, defaultCount } from "../text-field/text-field.machine"
import { textFieldMessages } from "../text-field/text-field.messages"
import type { PromptInputMessages } from "./prompt-input.messages"

/** One attached file, or a consumer item without a `File` (an uploaded document). */
export interface PromptAttachment {
  /** Unique within the input. */
  readonly id: string
  /** Shown and announced; names the chip. */
  readonly name: string
  /** The file itself, when the user attached one (it is also in the form's data). */
  readonly file?: File | undefined
  /** MIME type. */
  readonly type?: string | undefined
  /** Size in bytes. */
  readonly size?: number | undefined
  /** Still uploading: the input is not submittable while any attachment is pending. */
  readonly pending?: boolean | undefined
  /** The user cannot remove it. */
  readonly disabled?: boolean | undefined
}

// One to one with a chat state's ready / submitted / streaming / error.
/** The request status the consumer reports. */
export type PromptInputStatus = "idle" | "submitting" | "streaming" | "error"

/** The machine's states (also `data-state`). */
export type PromptInputState = "idle" | "composing" | "submitting" | "streaming" | "stopped"

/** What one submit sends: the draft and the attachments as they were at submit time. */
export interface PromptMessage {
  /** The draft. */
  readonly text: string
  /** The attachments, in order. */
  readonly attachments: readonly PromptAttachment[]
}

/** The second argument of `onSubmit`. */
export interface PromptSubmitDetails {
  /** The native `submit` event (null for a programmatic submit without a form). */
  readonly event: Event | null
  /** The form's data: the text under the Textarea's name, the files under the file input's. */
  readonly formData: FormData | null
}

/** Which keys submit from the Textarea. */
export type PromptSubmitKey = "enter" | "mod+enter" | "none"

/** Why the draft changed (`onValueChange` details). */
export type PromptValueReason = "input" | "submit" | "restore" | "history" | "api" | "reset"
/** Why the attachments changed (`onAttachmentsChange` details). */
export type PromptAttachmentsReason = "add" | "remove" | "submit" | "restore"

export type PromptInputEvent =
  | InputChipsEvent
  | {
      readonly type: "INPUT"
      readonly value: string
      readonly composing: boolean
      /** Set when the change is the machine's own write (`writeDraft`) coming back. */
      readonly reason?: PromptValueReason | undefined
    }
  | { readonly type: "COMPOSITION.START" }
  /** Back in idle while a composition is still open (a request ended meanwhile). */
  | { readonly type: "COMPOSITION.RESUME" }
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
  /** The send settled: the promise `onSubmit` returned, or at once without one (by token). */
  | {
      readonly type: "SETTLED"
      readonly token: number
      readonly ok: boolean
      /** Settled within the submit (no promise, or a throw), not by a pending promise. */
      readonly sync?: boolean | undefined
    }
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
  /** A programmatic draft change (`usePromptInput().setValue`, a suggestion). */
  | { readonly type: "SET.VALUE"; readonly value: string }
  /** Inserts `text` over `[start, end)` of the draft (the caret or the selection). */
  | {
      readonly type: "INSERT.TEXT"
      readonly text: string
      readonly start: number
      readonly end: number
    }
  /** A form reset: the draft is the Textarea's value after it. */
  | { readonly type: "RESET"; readonly value: string }

export interface PromptInputProps {
  /** The draft (controlled). */
  readonly value?: string | undefined
  /** The initial draft (uncontrolled). */
  readonly defaultValue?: string | undefined
  /** Every draft change; the adapter turns the details into a `PromptValueReason`. */
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<PromptInputEvent>) => void)
    | undefined
  /** The attachments (controlled). */
  readonly attachments?: readonly PromptAttachment[] | undefined
  /** The initial attachments (uncontrolled). */
  readonly defaultAttachments?: readonly PromptAttachment[] | undefined
  /** Every attachments change; the adapter turns the details into a reason. */
  readonly onAttachmentsChange?:
    | ((attachments: readonly PromptAttachment[], details: ChangeDetails<PromptInputEvent>) => void)
    | undefined
  /** The request's progress, reported by the consumer. */
  readonly status?: PromptInputStatus | undefined
  /** Sends the prompt; a returned promise keeps the input submitting until it settles. */
  readonly onSubmit?:
    | ((message: PromptMessage, details: PromptSubmitDetails) => unknown)
    | undefined
  /** Submit pressed while busy. */
  readonly onStop?: (() => void) | undefined
  /** Files refused by the limits, each with its reason. */
  readonly onReject?: ((rejections: readonly FileRejection[]) => void) | undefined
  /** A synchronous throw of `onSubmit`, handed back so the adapter rethrows it to its caller. */
  readonly onThrow?: ((error: unknown) => void) | undefined
  /**
   * Writes the whole draft as an undoable edit and lets the resulting `input` event come back
   * as INPUT (with `reason`); returns false when it did not write (the machine then sets the
   * value itself). Absent: the machine sets the value.
   */
  readonly writeDraft?: ((text: string, reason: PromptValueReason) => boolean) | undefined
  /** Every part is disabled. */
  readonly disabled?: boolean | undefined
  /** No typing and no files. */
  readonly readOnly?: boolean | undefined
  /** Past prompts, newest last. */
  readonly history?: readonly string[] | undefined
  /** The `<input accept>` list. */
  readonly accept?: string | undefined
  /** The most attachments at once. */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes. */
  readonly maxFileSize?: number | undefined
  /** A CharacterCount's `max` (soft limit). */
  readonly limit?: number | undefined
  /** A CharacterCount's counter (a tokenizer for a token limit). */
  readonly count?: ((value: string) => number) | undefined
  /** Announce the count when this many or fewer remain. */
  readonly threshold?: number | undefined
  /** The instance id (attachment ids, announcement keys). */
  readonly id: string
  /** For plural rules. */
  readonly locale: string
  readonly messages: PromptInputMessages
}

export interface PromptInputContext extends InputChipsContext {
  readonly focused: boolean
  readonly composing: boolean
  /** The draft when the current composition started: counts freeze on it meanwhile. */
  readonly committed: string
  readonly dragging: boolean
  /** The current submit; a settle of an older one is ignored. */
  readonly token: number
  /** The promise of the current submit has not settled. */
  readonly pending: boolean
  /** The message of the current submit, until it settled. */
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
const interactive = (p: Pick<PromptInputProps, "disabled" | "readOnly">) =>
  p.disabled !== true && p.readOnly !== true

/** What a view of the machine derives (spec "Submittable", "Character And Token Limit"). */
export interface PromptInputDerived {
  /** The draft that counts: the committed one while a composition is open. */
  readonly counted: string
  /** The count of `counted` (characters, or the consumer's tokens). */
  readonly used: number
  readonly overLimit: boolean
  /** The one guard every submit path asks, apart from the state. */
  readonly submittable: boolean
  /** What ArrowUp / ArrowDown would recall; `browsing`: the draft is a recalled entry. */
  readonly recall: { readonly older: boolean; readonly newer: boolean; readonly browsing: boolean }
}

/** Derives the counts, the limit, the submit guard and the recall options. */
export function derivePromptInput(
  p: Pick<PromptInputProps, "disabled" | "limit" | "count" | "history">,
  value: string,
  attachments: readonly PromptAttachment[],
  c: Pick<PromptInputContext, "composing" | "committed" | "historyIndex">,
): PromptInputDerived {
  const counted = c.composing ? c.committed : value
  const used = (p.count ?? defaultCount)(counted)
  const overLimit = p.limit !== undefined && used > p.limit
  const history = p.history ?? []
  const at = c.historyIndex
  const browsing = at !== null && history[at] === value
  return {
    counted,
    used,
    overLimit,
    submittable:
      p.disabled !== true &&
      !c.composing &&
      (value.trim() !== "" || attachments.length > 0) &&
      !attachments.some((a) => a.pending === true) &&
      !overLimit,
    recall: {
      older:
        !c.composing && history.length > 0 && (at === null ? value === "" : browsing && at > 0),
      newer: !c.composing && at !== null,
      browsing,
    },
  }
}

const derived = (a: Pick<Args, "props" | "values" | "context">) =>
  derivePromptInput(a.props, a.values.value, attachmentsOf(a), a.context)

/** A draft change's public reason, from the machine event that made it. */
export function promptValueReason(event: { readonly type: string }): PromptValueReason {
  const e = event as { readonly type: string; readonly reason?: PromptValueReason }
  if (e.type === "INPUT" && e.reason) return e.reason
  switch (e.type) {
    case "SUBMIT":
      return "submit"
    case "SETTLED":
    case "STATUS":
      return "restore"
    case "RECALL":
      return "history"
    case "SET.VALUE":
    case "INSERT.TEXT":
      return "api"
    case "RESET":
      return "reset"
    default:
      return "input"
  }
}

/** An attachments change's public reason, from the machine event that made it. */
export function promptAttachmentsReason(event: { readonly type: string }): PromptAttachmentsReason {
  switch (event.type) {
    case "FILES.ADD":
      return "add"
    case "SUBMIT":
      return "submit"
    case "SETTLED":
    case "STATUS":
      return "restore"
    default:
      return "remove"
  }
}

const announce = (a: Args, message: string, assertive = false, key?: string) =>
  a.env.announcer.announce({
    message,
    priority: assertive ? "assertive" : "polite",
    ...(key ? { key: `prompt-input-${a.props.id}-${key}` } : {}),
  })

/**
 * The machine's own draft writes (clear, restore, recall, the API): an undoable edit through
 * the adapter when it can (its `input` event comes back as INPUT), else a plain set. Never
 * while composing.
 */
function writeDraft(a: Args, text: string, reason: PromptValueReason) {
  if (a.context.composing) return
  if (text === a.values.value) return
  if (a.props.writeDraft?.(text, reason) === true) return
  a.set("value", text)
}

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

/** idle and composing start a request the consumer reports (initial status, suggestions). */
const startFromStatus = [
  { guard: "statusSubmitting", target: "submitting" },
  { guard: "statusStreaming", target: "streaming" },
] as const

export const promptInputMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    submittable: (a) => derived(a).submittable,
    commits: ({ event }) => event.type === "INPUT" && !event.composing,
    notComposing: ({ context }) => !context.composing,
    clickOnce: ({ event }) => event.type === "STOP" && event.clickCount <= 1,
    /** This submit's settle: within the submit, or of its still-pending promise. */
    currentToken: ({ event, context }) =>
      event.type === "SETTLED" &&
      event.token === context.token &&
      (event.sync === true || context.pending),
    settledOk: ({ event }) => event.type === "SETTLED" && event.ok,
    /** The consumer does not report a running request: a settled send ends it. */
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
    canRecall: (a) =>
      a.event.type === "RECALL" &&
      (a.event.direction === "older" ? derived(a).recall.older : derived(a).recall.newer),
    editable: ({ props, context }) => interactive(props) && !context.composing,
  },
  actions: {
    ...inputChipsActions,
    setFocused: ({ set }) => set("focused", true),
    blurred: ({ set }) => {
      set("focused", false)
      // A composition that never ended (dead keys) ends here.
      set("composing", false)
      set("armedChip", null)
    },
    startComposing: ({ set, values }) => {
      set("composing", true)
      set("committed", values.value)
    },
    endComposing: ({ set }) => set("composing", false),
    /** The Textarea's value (typing, a composition, the machine's own write coming back). */
    setValue: (a) => {
      const e = a.event
      if (e.type !== "INPUT" && e.type !== "COMPOSITION.END" && e.type !== "RESET") return
      if (e.type === "INPUT" && !e.composing) a.set("composing", false)
      a.set("armedChip", null)
      if (e.value !== a.values.value) a.set("value", e.value)
      // Typing leaves the recalled entry (it is now the user's draft).
      if (a.context.historyIndex !== null) {
        const entry = a.props.history?.[a.context.historyIndex]
        if (entry !== e.value) a.set("historyIndex", null)
      }
    },
    apiValue: (a) => {
      if (a.event.type === "SET.VALUE") writeDraft(a, a.event.value, "api")
      if (a.event.type === "INSERT.TEXT") {
        const v = a.values.value
        const { text, start, end } = a.event
        writeDraft(a, v.slice(0, start) + text + v.slice(end), "api")
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
      writeDraft(a, "", "submit")
      if (attachments.length > 0) a.set("attachments", NONE)
      const details = { event: a.event.event, formData: a.event.formData }
      let result: unknown
      try {
        result = a.props.onSubmit?.({ text, attachments }, details)
      } catch (error) {
        a.send({ type: "SETTLED", token, ok: false, sync: true })
        // Handed back: the adapter rethrows it to the caller once the step is done.
        a.props.onThrow?.(error)
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
      } else {
        // Nothing to wait for: ready at once; `status` then takes it from idle.
        a.send({ type: "SETTLED", token, ok: true, sync: true })
      }
    },
    settled: ({ set }) => set("pending", false),
    /**
     * A send settled well. A promise's settle ends the request: the snapshot goes. Without a
     * promise the request may go on under `status` (an error then still restores it).
     */
    settleSend: ({ set, context }) => {
      if (context.pending) set("snapshot", null)
      set("pending", false)
    },
    clearSnapshot: ({ set }) => set("snapshot", null),
    /** A failed send: announce; restore into an empty draft only (spec "Failed Send"). */
    failSend: (a) => {
      announce(a, a.props.messages.sendFailedAnnouncement, true)
      const snap = a.context.snapshot
      a.set("snapshot", null)
      if (!snap || a.values.value !== "" || attachmentsOf(a).length > 0) return
      if (snap.text !== "") writeDraft(a, snap.text, "restore")
      if (snap.attachments.length > 0) a.set("attachments", snap.attachments)
    },
    announceFailure: (a) => {
      a.set("snapshot", null)
      announce(a, a.props.messages.sendFailedAnnouncement, true)
    },
    callOnStop: (a) => a.props.onStop?.(),
    announceStopped: (a) => announce(a, a.props.messages.stoppedAnnouncement),
    /** Nothing reports the end of a stopped request: idle at once. */
    settleStop: (a) => {
      if (a.props.status === undefined && !a.context.pending) a.send({ type: "STOP.SETTLE" })
    },
    /** The initial `status` decides the first state (idle by default). */
    initialStatus: (a) => {
      if (a.event.type !== "$start") return
      if (a.props.status === "submitting" || a.props.status === "streaming") {
        a.send({ type: "STATUS" })
      }
    },
    /** Back in idle while a composition is open: composing again (no key may send). */
    resumeComposing: (a) => {
      if (a.context.composing) a.send({ type: "COMPOSITION.RESUME" })
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
      a.set("armedChip", null)
      writeDraft(a, a.values.value + a.event.text, "input")
    },
    recall: (a) => {
      if (a.event.type !== "RECALL") return
      const history = a.props.history ?? []
      const at = a.context.historyIndex
      if (a.event.direction === "older") {
        if (at === null) a.set("savedDraft", a.values.value)
        const next = at === null ? history.length - 1 : at - 1
        a.set("historyIndex", next)
        writeDraft(a, history[next] ?? "", "history")
        return
      }
      if (at === null) return
      const next = at + 1
      if (next >= history.length) {
        a.set("historyIndex", null)
        writeDraft(a, a.context.savedDraft, "history")
      } else {
        a.set("historyIndex", next)
        writeDraft(a, history[next] ?? "", "history")
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
    committed: "",
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
    RESET: { actions: ["setValue"] },
    "SET.VALUE": { guard: "notComposing", actions: ["apiValue"] },
    "INSERT.TEXT": { guard: "notComposing", actions: ["apiValue"] },
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
      entry: ["initialStatus", "resumeComposing"],
      on: {
        "COMPOSITION.START": { target: "composing", actions: ["startComposing"] },
        "COMPOSITION.RESUME": "composing",
        SUBMIT: { guard: "submittable", target: "submitting", actions: ["submit"] },
        STATUS: startFromStatus,
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
        // A request the consumer starts meanwhile is not lost (the composition goes on).
        STATUS: startFromStatus,
      },
    },
    submitting: {
      on: {
        STATUS: [
          { guard: "statusStreaming", target: "streaming" },
          { guard: "statusError", target: "idle", actions: ["failSend"] },
          { guard: "statusIdle", target: "idle", actions: ["clearSnapshot"] },
        ],
        SETTLED: [
          {
            guard: { and: ["currentToken", "settledOk", "notStreaming"] },
            target: "idle",
            actions: ["settleSend"],
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
          { guard: "statusIdle", target: "idle", actions: ["clearSnapshot"] },
        ],
        SETTLED: [
          {
            guard: { and: ["currentToken", "settledOk", "notStreaming"] },
            target: "idle",
            actions: ["settleSend"],
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
          { guard: "statusIdle", target: "idle", actions: ["clearSnapshot"] },
          { guard: "statusError", target: "idle", actions: ["clearSnapshot"] },
        ],
        SETTLED: {
          guard: "currentToken",
          target: "idle",
          actions: ["settled", "clearSnapshot"],
        },
        "STOP.SETTLE": { target: "idle", actions: ["clearSnapshot"] },
      },
    },
  },
})
export type PromptInputMachine = typeof promptInputMachine
