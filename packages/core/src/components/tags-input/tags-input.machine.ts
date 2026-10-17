// Tags Input (design §1): flat `idle | typing | editing`. One creation path, `createTags`,
// serves Enter, delimiters, paste, blur `add` and `ADD`, so the rules cannot drift between
// entry paths. Chips are `input-chips`; tags are keyed per design §2.

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
import {
  type Delimiters,
  defaultPasteDelimiters,
  hasDelimiter,
  joiner,
  splitDelimited,
} from "./split"
import type { TagRefusalReason, TagsInputMessages } from "./tags-input.messages"

export type TagsInputEvent =
  | InputChipsEvent
  | {
      readonly type: "INPUT.CHANGE"
      readonly text: string
      readonly inputType: string
      readonly composing: boolean
      readonly caretAtEnd: boolean
    }
  /** A paste with a paste delimiter (connect prevents the browser's insertion). */
  | { readonly type: "PASTE"; readonly text: string; readonly composing: boolean }
  | { readonly type: "ENTER"; readonly composing: boolean }
  | { readonly type: "ESCAPE"; readonly composing: boolean }
  /** Any caret move or press in the input: disarms. */
  | { readonly type: "CARET" }
  | { readonly type: "INPUT.FOCUS"; readonly modality: Modality }
  /** Focus left the component (not between its own parts). */
  | { readonly type: "FOCUS.LEAVE" }
  | { readonly type: "TAG.EDIT"; readonly key: string }
  | { readonly type: "EDIT.CHANGE"; readonly text: string }
  | { readonly type: "EDIT.COMMIT"; readonly composing: boolean }
  | { readonly type: "EDIT.CANCEL"; readonly composing: boolean }
  | { readonly type: "EDIT.BLUR" }
  | { readonly type: "CLEAR.PRESS" }
  | { readonly type: "ADD"; readonly text: string }
  | { readonly type: "CLEAR" }
  | { readonly type: "FORM.RESET" }
  /** The controlled `value` changed (onProps). */
  | { readonly type: "VALUE.SYNC" }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly text: string; readonly caretAtEnd: boolean }

export interface TagRefusal {
  readonly reason: TagRefusalReason
  readonly text: string
}

export interface TagsInputProps {
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<TagsInputEvent>) => void)
    | undefined
  readonly inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: ChangeDetails<TagsInputEvent>) => void)
    | undefined
  /** Default ",". */
  readonly delimiter?: Delimiters | undefined
  /** Default: the delimiters plus newline, tab and ";". */
  readonly pasteDelimiter?: Delimiters | undefined
  /** Default true. */
  readonly addOnPaste?: boolean | undefined
  /** Default: trim surrounding whitespace. */
  readonly normalize?: ((text: string) => string) | undefined
  readonly allowDuplicates?: boolean | undefined
  /** Default: exact string equality. */
  readonly compare?: ((a: string, b: string) => boolean) | undefined
  readonly max?: number | undefined
  /** `true` accepts; a string refuses with that reason. */
  readonly validate?: ((text: string, value: readonly string[]) => true | string) | undefined
  readonly onRefuse?: ((refusal: TagRefusal) => void) | undefined
  /** Default "keep". */
  readonly blurBehavior?: "keep" | "add" | "clear" | undefined
  /** Default true. */
  readonly editable?: boolean | undefined
  /** Default true. */
  readonly removeOnBackspace?: boolean | undefined
  /** Tags the user cannot remove or edit (by key). */
  readonly disabledKeys?: ReadonlySet<string> | undefined
  /** A tag's display text (default: the tag itself). */
  readonly textOf?: ((tag: string) => string) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly locale: string
  readonly messages: TagsInputMessages
}

export interface TagsInputContext extends InputChipsContext {
  readonly focused: boolean
  readonly composing: boolean
  /** The draft's refusal, until the draft next changes. */
  readonly refusal: TagRefusal | null
  /** The draft a creation cleared (restored when the parent refuses the value). */
  readonly clearedDraft: string | null
  readonly editingKey: string | null
  readonly editText: string
  readonly editRefusal: TagRefusal | null
  /** The over-`max` value last reported to `onRefuse` (once per value). */
  readonly overMaxReported: string | null
}

type Types = {
  props: TagsInputProps
  events: TagsInputEvent
  env: AnnouncerEnv
  context: TagsInputContext
  values: "value" | "inputValue"
}
type Args = ActionArgs<Types>

const EMPTY: readonly string[] = []

/** Tag keys (design §2): the value, or the value and its occurrence with duplicates. */
export function tagKeys(value: readonly string[], allowDuplicates: boolean): readonly string[] {
  if (!allowDuplicates) return value
  const seen = new Map<string, number>()
  return value.map((v) => {
    const n = seen.get(v) ?? 0
    seen.set(v, n + 1)
    return `${v}\u0000${n}`
  })
}

/** The chips of the tags. */
export function tagChips(
  p: Pick<TagsInputProps, "allowDuplicates" | "disabledKeys" | "textOf" | "disabled" | "readOnly">,
  value: readonly string[],
): readonly Chip[] {
  const keys = tagKeys(value, p.allowDuplicates === true)
  // Read-only chips stay navigable (their text can be read); removal is guarded instead.
  const locked = p.disabled === true
  return value.map((tag, i) => {
    const key = keys[i] ?? tag
    return {
      key,
      text: p.textOf?.(tag) ?? tag,
      disabled: locked || p.disabledKeys?.has(key) === true,
    }
  })
}

const interactive = (p: TagsInputProps) => p.disabled !== true && p.readOnly !== true
const normalizeOf = (p: TagsInputProps) => p.normalize ?? ((t: string) => t.trim())
const delimitersOf = (p: TagsInputProps) => p.delimiter ?? ","
const textOf = (p: TagsInputProps, tag: string) => p.textOf?.(tag) ?? tag

function refuse(a: Args, refusal: TagRefusal, where: "draft" | "edit") {
  a.set(where === "draft" ? "refusal" : "editRefusal", refusal)
  a.props.onRefuse?.(refusal)
  a.env.announcer.announce({
    message: a.props.messages.refusedAnnouncement(refusal.reason, refusal.text),
    priority: "polite",
    key: "tags-input:refused",
  })
}

/**
 * The one creation path: normalise, drop empty, max, duplicates (within the batch too),
 * validate; one value proposal; the first refusal reported. Returns the refused texts.
 */
function createTags(a: Args, texts: readonly string[]) {
  const { props } = a
  const norm = normalizeOf(props)
  const compare = props.compare ?? ((x: string, y: string) => x === y)
  const value = [...(a.values.value as readonly string[])]
  const accepted: string[] = []
  const refused: string[] = []
  let first: TagRefusal | null = null
  for (const raw of texts) {
    const text = norm(raw)
    if (text === "") continue
    const all = [...value, ...accepted]
    let why: TagRefusalReason | null = null
    if (props.max !== undefined && all.length >= props.max) why = "max"
    else if (!props.allowDuplicates && all.some((t) => compare(t, text))) why = "duplicate"
    else {
      const v = props.validate?.(text, all) ?? true
      if (v !== true) why = v
    }
    if (why === null) accepted.push(text)
    else {
      refused.push(raw)
      first ??= { reason: why, text }
    }
  }
  if (accepted.length > 0) {
    a.set("value", [...value, ...accepted])
    a.env.announcer.announce({
      message:
        accepted.length > 1
          ? props.messages.addedManyAnnouncement(accepted.length, props.locale)
          : props.messages.addedAnnouncement(textOf(props, accepted[0] ?? "")),
      priority: "polite",
      key: "tags-input:added",
    })
  }
  if (first) refuse(a, first, "draft")
  return { accepted, refused }
}

function setDraft(a: Args, text: string) {
  if (text !== a.values.inputValue) a.set("inputValue", text)
}

/** Clears the draft after a creation, remembering it for a refused proposal. */
function clearDraft(a: Args) {
  a.set("clearedDraft", a.values.inputValue)
  setDraft(a, "")
}

function removeTag(a: Args, key: string) {
  const value = a.values.value as readonly string[]
  const keys = tagKeys(value, a.props.allowDuplicates === true)
  const i = keys.indexOf(key)
  if (i < 0) return
  const tag = value[i] ?? ""
  a.set(
    "value",
    value.filter((_, j) => j !== i),
  )
  a.env.announcer.announce({
    message: a.props.messages.removedAnnouncement(textOf(a.props, tag)),
    priority: "polite",
    key: "tags-input:removed",
  })
}

/** What committing the edit would do, without doing it. */
function editOutcome(
  props: TagsInputProps,
  value: readonly string[],
  key: string | null,
  editText: string,
):
  | { readonly kind: "none" | "remove" | "same" }
  | { readonly kind: "update"; readonly index: number; readonly text: string }
  | { readonly kind: "refused"; readonly refusal: TagRefusal } {
  if (key === null) return { kind: "none" }
  const i = tagKeys(value, props.allowDuplicates === true).indexOf(key)
  if (i < 0) return { kind: "none" }
  const text = normalizeOf(props)(editText)
  if (text === "") return { kind: "remove" }
  if (text === value[i]) return { kind: "same" }
  const others = value.filter((_, j) => j !== i)
  const compare = props.compare ?? ((x: string, y: string) => x === y)
  if (!props.allowDuplicates && others.some((t) => compare(t, text))) {
    return { kind: "refused", refusal: { reason: "duplicate", text } }
  }
  const v = props.validate?.(text, others) ?? true
  if (v !== true) return { kind: "refused", refusal: { reason: v, text } }
  return { kind: "update", index: i, text }
}

const chipsOf = (a: Pick<Args, "props" | "values">) =>
  tagChips(a.props, a.values.value as readonly string[])

export const tagsInputMachine = setup({
  types: type<Types>(),
  guards: {
    interactive: ({ props }) => interactive(props),
    notComposing: ({ event, context }) =>
      !context.composing && !("composing" in event && event.composing === true),
    draftNotEmpty: ({ props, values }) => normalizeOf(props)(values.inputValue) !== "",
    editable: ({ props, event, values }) =>
      props.editable !== false &&
      interactive(props) &&
      event.type === "TAG.EDIT" &&
      chipsOf({ props, values }).some((c) => c.key === event.key && !c.disabled),
    armedRemovable: ({ context, props }) => context.armedChip !== null && interactive(props),
    armsOnBackspace: ({ props, values }) =>
      props.removeOnBackspace !== false &&
      interactive(props) &&
      lastRemovable(chipsOf({ props, values })) !== null,
    chipRemovable: ({ event, props, values }) =>
      event.type === "CHIP.REMOVE" &&
      interactive(props) &&
      chipsOf({ props, values }).some((c) => c.key === event.key && !c.disabled),
    pasteTakenOver: ({ props, event }) =>
      event.type === "PASTE" &&
      props.addOnPaste !== false &&
      hasDelimiter(event.text, props.pasteDelimiter ?? defaultPasteDelimiters(delimitersOf(props))),
    blurAdds: ({ props }) => props.blurBehavior === "add",
    editRefused: ({ props, values, context }) =>
      editOutcome(props, values.value as readonly string[], context.editingKey, context.editText)
        .kind === "refused",
    blurClears: ({ props }) => props.blurBehavior === "clear",
  },
  actions: {
    ...inputChipsActions,
    setFocused: ({ set }) => set("focused", true),
    leave: ({ set }) => {
      set("focused", false)
      set("armedChip", null)
      set("focusedChip", null)
      set("focusedChipModality", null)
    },
    startComposition: ({ set }) => set("composing", true),
    /** Typing: the draft, then complete segments when a delimiter was typed at the end. */
    typed: (a) => {
      const e = a.event
      if (e.type !== "INPUT.CHANGE" && e.type !== "COMPOSITION.END") return
      if (e.type === "COMPOSITION.END") a.set("composing", false)
      a.set("refusal", null)
      a.set("armedChip", null)
      a.set("clearedDraft", null)
      const composing = e.type === "INPUT.CHANGE" && (e.composing || a.context.composing)
      if (composing || !e.caretAtEnd || !interactive(a.props)) return setDraft(a, e.text)
      const { complete, rest } = splitDelimited(e.text, delimitersOf(a.props))
      if (complete.length === 0) return setDraft(a, e.text)
      const { refused } = createTags(a, complete)
      // A refused segment stays in the draft, before the rest.
      setDraft(
        a,
        refused.length > 0 ? [...refused, rest].join(joiner(delimitersOf(a.props))) : rest,
      )
    },
    enter: (a) => {
      a.set("armedChip", null)
      const { accepted } = createTags(a, [a.values.inputValue])
      if (accepted.length > 0) clearDraft(a)
    },
    paste: (a) => {
      if (a.event.type !== "PASTE") return
      const { props } = a
      const delimiters = props.pasteDelimiter ?? defaultPasteDelimiters(delimitersOf(props))
      // The pasted text joins the draft before splitting (it is inserted at the end).
      const { complete, rest } = splitDelimited(a.values.inputValue + a.event.text, delimiters)
      a.set("refusal", null)
      const { refused } = createTags(a, [...complete, rest])
      a.set("clearedDraft", a.values.inputValue)
      setDraft(a, refused.map(normalizeOf(props)).join(joiner(delimitersOf(props))))
    },
    blurAdd: (a) => {
      const { accepted } = createTags(a, [a.values.inputValue])
      if (accepted.length > 0) clearDraft(a)
    },
    blurClear: (a) => setDraft(a, ""),
    arm: (a) => a.set("armedChip", lastRemovable(chipsOf(a))),
    removeArmed: (a) => {
      const key = a.context.armedChip
      a.set("armedChip", null)
      if (key !== null) removeTag(a, key)
    },
    removeChip: (a) => {
      if (a.event.type === "CHIP.REMOVE") removeTag(a, a.event.key)
    },
    chipType: (a) => {
      if (a.event.type !== "CHIP.TYPE") return
      a.set("refusal", null)
      setDraft(a, a.values.inputValue + a.event.text)
      a.set("armedChip", null)
    },
    clearAll: (a) => {
      const chips = chipsOf(a)
      const value = a.values.value as readonly string[]
      const kept = value.filter((_, i) => chips[i]?.disabled === true)
      if (kept.length !== value.length) a.set("value", kept)
      setDraft(a, "")
      a.set("refusal", null)
      a.set("armedChip", null)
      a.env.announcer.announce({
        message: a.props.messages.clearedAnnouncement,
        priority: "polite",
        key: "tags-input:cleared",
      })
    },
    add: (a) => {
      if (a.event.type === "ADD") createTags(a, [a.event.text])
    },
    reset: (a) => {
      a.set("value", a.props.defaultValue ?? EMPTY)
      setDraft(a, "")
      a.set("refusal", null)
      a.set("editingKey", null)
    },
    /** The parent refused the value: a creation's draft comes back (Values). */
    revert: (a) => {
      if (a.event.type !== "$reverted" || a.event.key !== "value") return
      const draft = a.context.clearedDraft
      a.set("clearedDraft", null)
      if (draft !== null) setDraft(a, draft)
    },
    startEdit: (a) => {
      if (a.event.type !== "TAG.EDIT") return
      const value = a.values.value as readonly string[]
      const i = tagKeys(value, a.props.allowDuplicates === true).indexOf(a.event.key)
      a.set("editingKey", a.event.key)
      a.set("editText", value[i] ?? "")
      a.set("editRefusal", null)
      a.set("armedChip", null)
    },
    editChange: (a) => {
      if (a.event.type !== "EDIT.CHANGE") return
      a.set("editText", a.event.text)
      a.set("editRefusal", null)
    },
    /** Commit: normalised and checked like a new tag (its own text excepted); empty removes. */
    commitEdit: (a) => {
      const { props, context } = a
      const value = a.values.value as readonly string[]
      const key = context.editingKey
      const out = editOutcome(props, value, key, context.editText)
      if (out.kind === "refused") return refuse(a, out.refusal, "edit")
      a.set("editingKey", null)
      a.set("editRefusal", null)
      if (out.kind === "remove" && key !== null) return removeTag(a, key)
      if (out.kind !== "update") return
      a.set(
        "value",
        value.map((t, j) => (j === out.index ? out.text : t)),
      )
      a.env.announcer.announce({
        message: props.messages.updatedAnnouncement(textOf(props, out.text)),
        priority: "polite",
        key: "tags-input:updated",
      })
    },
    /** A controlled value longer than `max` is shown as given and reported once (Maximum). */
    checkMax: (a) => {
      const { props } = a
      const value = a.values.value as readonly string[]
      if (props.max === undefined || value.length <= props.max) return
      const id = JSON.stringify(value)
      if (a.context.overMaxReported === id) return
      a.set("overMaxReported", id)
      props.onRefuse?.({ reason: "max", text: value[props.max] ?? "" })
    },
    cancelEdit: ({ set }) => {
      set("editingKey", null)
      set("editRefusal", null)
    },
  },
}).machine({
  id: "tags-input",
  initial: "idle",
  context: () => ({
    ...initialInputChipsContext(),
    focused: false,
    composing: false,
    refusal: null,
    clearedDraft: null,
    editingKey: null,
    editText: "",
    editRefusal: null,
    overMaxReported: null,
  }),
  values: {
    value: { fallback: EMPTY as string[] },
    inputValue: { fallback: "" },
  },
  onProps: { value: "VALUE.SYNC" },
  on: {
    $reverted: { actions: ["revert"] },
    "VALUE.SYNC": { actions: ["checkMax"] },
    "FORM.RESET": { target: "idle", actions: ["reset"] },
    ADD: { actions: ["add"] },
    CLEAR: { actions: ["clearAll"] },
    "CHIP.NAVIGATE": { target: "typing", actions: ["setFocused", "focusChip"] },
    "CHIP.BLUR": { actions: ["blurChip"] },
    // A remove press never moves focus: it applies in every state.
    "CHIP.REMOVE": { guard: "chipRemovable", actions: ["removeChip"] },
    "CHIP.TYPE": { guard: "interactive", target: "typing", actions: ["setFocused", "chipType"] },
    "CLEAR.PRESS": { guard: "interactive", target: "typing", actions: ["setFocused", "clearAll"] },
  },
  states: {
    idle: {
      entry: ["checkMax"],
      on: {
        "INPUT.FOCUS": { target: "typing", actions: ["setFocused"] },
        "INPUT.CHANGE": { target: "typing", actions: ["setFocused", "typed"] },
        "COMPOSITION.START": { target: "typing", actions: ["setFocused", "startComposition"] },
        PASTE: { guard: "pasteTakenOver", target: "typing", actions: ["setFocused", "paste"] },
      },
    },
    typing: {
      on: {
        "INPUT.CHANGE": { actions: ["typed"] },
        "COMPOSITION.START": { actions: ["startComposition"] },
        "COMPOSITION.END": { actions: ["typed"] },
        PASTE: { guard: { and: ["notComposing", "pasteTakenOver"] }, actions: ["paste"] },
        ENTER: {
          guard: { and: ["notComposing", "interactive", "draftNotEmpty"] },
          actions: ["enter"],
        },
        CARET: { actions: ["disarm"] },
        BACKSPACE_EMPTY: [
          { guard: { and: ["notComposing", "armedRemovable"] }, actions: ["removeArmed"] },
          { guard: { and: ["notComposing", "armsOnBackspace"] }, actions: ["arm"] },
        ],
        "TAG.EDIT": { guard: "editable", target: "editing", actions: ["startEdit"] },
        "FOCUS.LEAVE": [
          {
            guard: { and: ["blurAdds", "interactive", "draftNotEmpty"] },
            target: "idle",
            actions: ["leave", "blurAdd"],
          },
          {
            guard: { and: ["blurClears", "interactive"] },
            target: "idle",
            actions: ["leave", "blurClear"],
          },
          { target: "idle", actions: ["leave"] },
        ],
      },
    },
    editing: {
      on: {
        "EDIT.CHANGE": { actions: ["editChange"] },
        // A refused commit keeps the ChipInput open.
        "EDIT.COMMIT": [
          { guard: { and: ["notComposing", "editRefused"] }, actions: ["commitEdit"] },
          { guard: "notComposing", target: "typing", actions: ["commitEdit"] },
        ],
        "EDIT.CANCEL": { guard: "notComposing", target: "typing", actions: ["cancelEdit"] },
        "EDIT.BLUR": [
          { guard: "editRefused", actions: ["commitEdit"] },
          { target: "typing", actions: ["commitEdit"] },
        ],
        "FOCUS.LEAVE": [
          { guard: "editRefused", actions: ["commitEdit"] },
          { target: "idle", actions: ["commitEdit", "leave"] },
        ],
      },
    },
  },
})
export type TagsInputMachine = typeof tagsInputMachine
