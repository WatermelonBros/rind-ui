// File Upload (add-file-upload design §2): the value is a list of file records, the native
// input only mirrors it. Every source (chooser, drop, paste, API) is one gesture through one
// validation; one write path reports the whole list (uncontrolled: set and mirrored at once;
// controlled: proposed, mirrored when the prop arrives). States `idle` / `dragging`; no
// verdict while dragging (nothing about the files is readable before the drop).

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { type FileLike, type FileRejection, validateFiles } from "../shared/file-validation"
import type { FileUploadMessages } from "./file-upload.messages"

export type FileUploadSource = "pick" | "drop" | "paste" | "api"

export type FileUploadEvent<F extends FileLike = FileLike> =
  | { readonly type: "DRAG.ENTER" }
  | { readonly type: "DRAG.LEAVE" }
  | {
      readonly type: "FILES.ADD"
      readonly files: readonly F[]
      readonly source: FileUploadSource
      /** Entries of a drop that could not be read (CUSTOM "unreadable"). */
      readonly refused?: readonly F[]
    }
  | { readonly type: "FILE.REMOVE"; readonly file: F }
  | { readonly type: "FILES.CLEAR" }
  | { readonly type: "REJECTIONS.CLEAR" }
  | { readonly type: "PICKER.OPEN" }
  /** The form's reset: restores the current `defaultFiles`. */
  | { readonly type: "RESET" }
  /** The controlled `files` prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }

/** The change reason `onFilesChange` receives. */
export type FileUploadChangeReason = "add" | "remove" | "clear" | "reset" | "api"

export interface FileUploadProps<F extends FileLike = FileLike> {
  /** The instance id (the announcements' key). */
  readonly id: string
  readonly messages: FileUploadMessages
  readonly lang?: string | undefined
  readonly files?: readonly F[] | undefined
  readonly defaultFiles?: readonly F[] | undefined
  readonly onFilesChange?:
    | ((files: readonly F[], details: ChangeDetails<FileUploadEvent<F>>) => void)
    | undefined
  /** The native `accept` grammar: MIME types, `type/*`, `.ext`. */
  readonly accept?: string | readonly string[] | undefined
  /** The most files held. Default 1 (a new file replaces the held one). */
  readonly maxFiles?: number | undefined
  readonly maxFileSize?: number | undefined
  readonly minFileSize?: number | undefined
  /** Folders are taken (traversed on drop, `webkitdirectory` on the chooser). */
  readonly directory?: boolean | undefined
  /** A custom check: a code rejects the file (`CUSTOM`). */
  readonly validate?:
    | ((file: F, context: { readonly files: readonly F[] }) => string | null)
    | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Once per gesture with any rejection. */
  readonly onReject?: ((rejections: readonly FileRejection<F>[]) => void) | undefined
}

/** What the machine reaches the DOM through (injected; absent in Node). */
export interface FileUploadEnv<F extends FileLike = FileLike> {
  /** Opens the native chooser, in the activation's task. */
  readonly openPicker?: (() => void) | undefined
  /** Mirrors the held `File`s on the input; `dispatch`: fire input and change. */
  readonly syncInput?: ((files: readonly F[], dispatch: boolean) => void) | undefined
}

export interface FileUploadContext<F extends FileLike = FileLike> {
  /** The last gesture's rejections. */
  readonly rejections: readonly FileRejection<F>[]
  /** A controlled proposal not yet answered; `user`: mirror with input and change. */
  readonly pending: { readonly files: readonly F[]; readonly user: boolean } | null
}

type Types = {
  props: FileUploadProps<FileLike>
  events: FileUploadEvent<FileLike>
  env: AnnouncerEnv & FileUploadEnv<FileLike>
  context: FileUploadContext<FileLike>
  values: "files"
}
type Args = ActionArgs<Types>

const controlled = (props: FileUploadProps) => props.files !== undefined
const isDirectoryRecord = (f: FileLike) => (f as { directory?: boolean }).directory === true
const latest = (args: Args) => args.values.files

/** The one write: proposes `next`; uncontrolled, mirrors it now if it was not refused. */
function write(args: Args, next: readonly FileLike[], user: boolean) {
  const { props, set, env } = args
  set("files", next)
  if (controlled(props)) {
    set("pending", { files: next, user })
    return
  }
  // Refused through details.cancel(): the input keeps the held files, no events.
  const after = args.values.files
  env.syncInput?.(after, user && after === next)
}

function say(args: Args, message: string, priority: "polite" | "assertive") {
  const { env, props } = args
  env.announcer.announce({
    message,
    priority,
    key: `file-upload-${props.id}-${priority}`,
    ...(props.lang === undefined ? {} : { lang: props.lang }),
  })
}

const editable = (props: FileUploadProps) => props.disabled !== true && props.readOnly !== true

export const fileUploadMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    editable: ({ props }) => editable(props),
  },
  actions: {
    add: (args) => {
      const { event, props, set } = args
      if (event.type !== "FILES.ADD") return
      const held = latest(args)
      const { accepted, rejected } = validateFiles(event.files, {
        accept: props.accept,
        maxFiles: props.maxFiles ?? 1,
        maxFileSize: props.maxFileSize,
        minFileSize: props.minFileSize,
        current: held,
        rejectDuplicates: true,
        replaceSingle: true,
        validate: props.validate,
        isDirectory: props.directory ? undefined : isDirectoryRecord,
      })
      const refused: FileRejection<FileLike>[] = (event.refused ?? []).map((file) => ({
        file,
        reason: props.directory ? "CUSTOM" : "DIRECTORY",
        ...(props.directory ? { code: "unreadable" } : {}),
      }))
      const rejections = [...rejected, ...refused]
      set("rejections", rejections)
      if (accepted.length > 0) {
        // `maxFiles` 1: the accepted file replaces the held one (zag#1903).
        const next = (props.maxFiles ?? 1) === 1 ? accepted : [...held, ...accepted]
        write(args, next, event.source !== "api")
        const m = props.messages
        const added =
          accepted.length === 1
            ? m.addedAnnouncement(accepted[0]?.name ?? "")
            : m.addedCountAnnouncement(accepted.length, props.lang ?? "en")
        say(args, added, "polite")
      }
      if (rejections.length > 0) {
        const m = props.messages
        const one = rejections[0]
        const message =
          rejections.length === 1 && one
            ? m.rejectedAnnouncement(one.file.name, one.reason)
            : m.rejectedCountAnnouncement(rejections.length, props.lang ?? "en")
        say(args, message, "assertive")
        props.onReject?.(rejections)
      }
    },
    remove: (args) => {
      const { event, props } = args
      if (event.type !== "FILE.REMOVE") return
      const held = latest(args)
      if (!held.includes(event.file)) return
      write(
        args,
        held.filter((f) => f !== event.file),
        true,
      )
      say(args, props.messages.removedAnnouncement(event.file.name), "polite")
    },
    clear: (args) => {
      if (latest(args).length === 0) return
      write(args, [], true)
      say(args, args.props.messages.clearedAnnouncement, "polite")
    },
    clearRejections: ({ set }) => set("rejections", []),
    restoreDefault: (args) => {
      args.set("rejections", [])
      write(args, args.props.defaultFiles ?? [], false)
    },
    openPicker: ({ env }) => env.openPicker?.(),
    /** The controlled list arrived: the pending proposal is mirrored now. */
    applySynced: (args) => {
      const { context, env, set, values } = args
      const pending = context.pending
      set("pending", null)
      env.syncInput?.(
        values.files,
        pending !== null && pending.files === values.files && pending.user,
      )
    },
    /** A refused proposal: forget it and put the input back. */
    revert: (args) => {
      args.set("pending", null)
      args.env.syncInput?.(args.values.files, false)
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
  },
}).machine({
  id: "file-upload",
  initial: "idle",
  context: () => ({ rejections: [], pending: null }),
  values: { files: { fallback: [] } },
  onProps: { files: "VALUE.SYNCED" },
  effects: ["prepareAnnouncer"],
  on: {
    "FILES.ADD": {
      guard: "editable",
      target: "idle",
      actions: ["add"],
      reason: (e: FileUploadEvent) =>
        e.type === "FILES.ADD" && e.source === "api" ? "api" : "add",
    },
    "FILE.REMOVE": { guard: "editable", actions: ["remove"], reason: "remove" },
    "FILES.CLEAR": { guard: "editable", actions: ["clear"], reason: "clear" },
    "REJECTIONS.CLEAR": { actions: ["clearRejections"] },
    "PICKER.OPEN": { guard: "editable", actions: ["openPicker"] },
    RESET: { target: "idle", actions: ["restoreDefault"], reason: "reset" },
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    idle: { on: { "DRAG.ENTER": { guard: "editable", target: "dragging" } } },
    dragging: { on: { "DRAG.LEAVE": "idle" } },
  },
})

export type FileUploadMachine = typeof fileUploadMachine
