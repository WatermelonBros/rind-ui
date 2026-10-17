// Toast data, ids and reasons (spec "Toast Data And Ids", "Pausing", "Dismissal Reasons").

/** A toast's id: given by the consumer or generated. */
export type ToastId = string & { readonly __toastId: true }
/** One show of a toast (a re-show during exit is a new record: sonner#791). */
export type ToastInstance = string & { readonly __toastInstance: true }

export type ToastType = "info" | "success" | "warning" | "error" | "loading"

export interface ToastAction {
  readonly label: string
  readonly onAction: () => void
  /** Default true: activating it dismisses the toast with reason `action`. */
  readonly closes?: boolean | undefined
}

/** What a toast is shown with. */
export interface ToastInput {
  readonly id?: string | undefined
  readonly type?: ToastType | undefined
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly action?: ToastAction | undefined
  /** ms; `Infinity` never times out. Default: the store's. */
  readonly duration?: number | undefined
  /** Default true: false ignores close trigger, Escape and swipe. */
  readonly dismissible?: boolean | undefined
  readonly meta?: Readonly<Record<string, unknown>> | undefined
  readonly onDismiss?: ((reason: ToastDismissReason) => void) | undefined
}

/** A shown toast's data: its id and type resolved. */
export interface ToastData extends Omit<ToastInput, "id" | "type"> {
  readonly id: ToastId
  readonly type: ToastType
}

export type ToastPauseReason =
  | "hover"
  | "focus"
  | "hidden"
  | "swipe"
  | "unmounted"
  | "limited"
  | "api"

export type ToastDismissReason =
  | "close-trigger"
  | "action"
  | "escape-key"
  | "swipe"
  | "timeout"
  | "api"

/** Persistent: loading, an infinite duration, or an action without an explicit duration. */
export const isPersistentToast = (data: Pick<ToastData, "type" | "duration" | "action">) =>
  data.type === "loading" ||
  data.duration === Number.POSITIVE_INFINITY ||
  (data.action !== undefined && data.duration === undefined)
