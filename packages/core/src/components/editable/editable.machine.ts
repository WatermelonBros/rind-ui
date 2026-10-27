// Editable (add-editable design §1–§3): preview and edit (the controllable `edit`), the
// committed value (controllable), a draft, and the value saved on entering edit, so Escape
// restores what was there at entry (zag#3510, #2743, #658). Every change carries its reason;
// a cancelled onEditChange keeps the user where they are (validation).

import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"

export type EditReason =
  | "edit-trigger"
  | "preview-press"
  | "preview-dblclick"
  | "preview-focus"
  | "preview-key"
  | "enter-key"
  | "escape-key"
  | "outside-press"
  | "submit-trigger"
  | "cancel-trigger"
  | "api"

export type EditableEvent =
  | { readonly type: "EDIT"; readonly reason: EditReason }
  | { readonly type: "DRAFT"; readonly draft: string }
  | { readonly type: "SUBMIT"; readonly reason: EditReason }
  | { readonly type: "CANCEL"; readonly reason: EditReason }
  /** An outside press while editing: submit or cancel by `submitMode` (design §3). */
  | { readonly type: "OUTSIDE" }
  /** The form's reset. */
  | { readonly type: "RESET" }

export type ActivationMode = "click" | "dblclick" | "focus" | "none"
export type SubmitMode = "both" | "enter" | "blur" | "none"

export interface EditableProps {
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  readonly edit?: boolean | undefined
  readonly defaultEdit?: boolean | undefined
  readonly onEditChange?:
    | ((edit: boolean, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  readonly onDraftChange?: ((draft: string) => void) | undefined
  readonly activationMode?: ActivationMode | undefined
  readonly submitMode?: SubmitMode | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Focus moves (the adapter's DOM). */
  readonly focusInput?: (() => void) | undefined
  readonly focusPreview?: (() => void) | undefined
}

export interface EditableContext {
  readonly draft: string
  /** The value when editing began (Escape restores it). */
  readonly saved: string
}

type Types = {
  props: EditableProps
  events: EditableEvent
  env: object
  context: EditableContext
  values: "value" | "edit"
}
type Args = ActionArgs<Types>

/** What an outside press does (design §3, the one table). */
export const outsidePressSubmits = (mode: SubmitMode | undefined) =>
  (mode ?? "both") === "both" || mode === "blur"

/** Whether a Preview interaction of `kind` enters edit in `mode` (keys always do, but `none`). */
export function activates(
  mode: ActivationMode | undefined,
  kind: "press" | "dblclick" | "focus" | "key",
) {
  const m = mode ?? "click"
  if (m === "none") return false
  if (kind === "key") return true
  return (
    (kind === "press" && m === "click") ||
    (kind === "dblclick" && m === "dblclick") ||
    (kind === "focus" && m === "focus")
  )
}

const value = (a: Args) => a.values.value ?? ""

export const editableMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    editable: ({ props }) => props.disabled !== true && props.readOnly !== true,
    outsideSubmits: ({ props }) => outsidePressSubmits(props.submitMode),
  },
  actions: {
    begin: (a) => {
      a.set("saved", value(a))
      a.set("draft", value(a))
      a.props.onDraftChange?.(value(a))
      a.props.focusInput?.()
    },
    draft: ({ event, props, set }) => {
      if (event.type !== "DRAFT") return
      set("draft", event.draft)
      props.onDraftChange?.(event.draft)
    },
    commit: (a) => {
      if (a.context.draft !== value(a)) a.set("value", a.context.draft)
    },
    restore: ({ context, props, set }) => {
      set("draft", context.saved)
      props.onDraftChange?.(context.saved)
    },
    /** Back to the Preview, unless the focus already moved elsewhere (an outside press). */
    focusBack: ({ event, props }) => {
      if (event.type !== "OUTSIDE") props.focusPreview?.()
    },
    restoreDefault: (a) => {
      a.set("value", a.props.defaultValue ?? "")
      a.set("draft", a.props.defaultValue ?? "")
    },
  },
}).machine({
  id: "editable",
  initial: "preview",
  context: (props) => {
    const v = props.value ?? props.defaultValue ?? ""
    return { draft: v, saved: v }
  },
  values: {
    value: { fallback: "" },
    edit: { fallback: false, states: { preview: false, edit: true } },
  },
  on: { RESET: { target: "preview", actions: ["restoreDefault"] } },
  states: {
    preview: {
      on: { EDIT: { guard: "editable", target: "edit", actions: ["begin"] } },
    },
    edit: {
      on: {
        DRAFT: { actions: ["draft"] },
        SUBMIT: { target: "preview", actions: ["commit", "focusBack"] },
        CANCEL: { target: "preview", actions: ["restore", "focusBack"] },
        OUTSIDE: [
          { guard: "outsideSubmits", target: "preview", actions: ["commit"] },
          { target: "preview", actions: ["restore"] },
        ],
      },
    },
  },
})

export type EditableMachine = typeof editableMachine
export type EditableState = "preview" | "edit"
