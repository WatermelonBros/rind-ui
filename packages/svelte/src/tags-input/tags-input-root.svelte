<script lang="ts">
// Tags Input (tags-input spec): Root owns the machine and the form inputs; the chips are
// rendered from the value. With suggestions, Root derives the listed ones from the draft
// (patternResults, without the chosen options) and the list parts are the listbox parts
// under scope "tags-input", the popup parts the Combobox's. Wiring only.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  domPositioning,
  focusSafely,
  hiddenFormInput,
  isEmptyState,
  isExposed,
  isStale,
  layoutCapability,
  mergeFieldProps,
  patternResults,
  type TagRefusal,
  tagChips,
  tagSuggestions,
  tagsInputConnect,
  tagsInputIds,
  tagsInputMachine,
  tagsInputMessages,
} from "@rind-ui/core"
import { flushSync, untrack } from "svelte"
import { popupHost } from "../combobox/context"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { listboxHost } from "../listbox/context"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { tagsInputHost } from "./context"
import type { TagsInputItemData, TagsInputRootProps } from "./types"

let {
  id,
  children,
  value = $bindable(),
  defaultValue,
  onValueChange,
  inputValue = $bindable(),
  defaultInputValue,
  onInputValueChange,
  ...p
}: TagsInputRootProps = $props()

const fromData = (list: readonly TagsInputItemData[]) =>
  createListCollection({
    items: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const NO_ITEMS = fromData([])
/** The machine event that changed the value, as the public reason. */
const reasonOf = (type: string, delimiter: boolean) =>
  ({
    ENTER: "enter",
    PASTE: "paste",
    "FOCUS.LEAVE": "blur",
    "EDIT.COMMIT": "edit",
    "EDIT.BLUR": "edit",
    "CHIP.REMOVE": "chip-remove",
    BACKSPACE_EMPTY: "backspace",
    "CLEAR.PRESS": "clear",
    CLEAR: "clear",
    "FORM.RESET": "reset",
    "INPUT.CHANGE": delimiter ? "delimiter" : "input-change",
    "COMPOSITION.END": delimiter ? "delimiter" : "input-change",
    "CHIP.TYPE": "input-change",
    ADD: "add",
    "ITEM.CHOOSE": "item-press",
  })[type] ?? type.toLowerCase()

const base = useEnvironment(announcerCapability, layoutCapability)
const env = { ...base, position: domPositioning(base) }
const uid = $props.id()
const instance = $derived(id ?? uid)
const binding = useFieldControl(uid)
const fieldsetDisabled = useFieldsetDisabled()
const field = $derived(
  mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled: p.disabled === true || fieldsetDisabled(),
      readOnly: p.readOnly,
      required: p.required,
      invalid: p.invalid,
      name: p.name,
    },
    binding?.() ?? null,
  ),
)
const ids = untrack(() => tagsInputIds(instance))
const locale = $derived(env.locale.locale())
const messages = $derived({ ...tagsInputMessages, ...p.messages })
const pending = { current: false }
let constraint: HTMLInputElement | null = null
let disabledKeys = $state.raw<ReadonlySet<string>>(new Set())
let mounted = $state.raw<{
  label: boolean
  empty: boolean
  descriptions: ReadonlySet<CollectionKey>
}>({ label: false, empty: false, descriptions: new Set() })
// Untracked: parts call these from their effects, which must not depend on what they write.
const mount = (part: "label" | "empty", on: boolean) =>
  untrack(() => {
    if (mounted[part] !== on) mounted = { ...mounted, [part]: on }
  })
const mountDescription = (key: CollectionKey, on: boolean) =>
  untrack(() => {
    if (mounted.descriptions.has(key) === on) return
    const next = new Set(mounted.descriptions)
    if (on) next.add(key)
    else next.delete(key)
    mounted = { ...mounted, descriptions: next }
  })
// Suggestions: every option, and the listed ones (the draft's, without the chosen tags).
const data = $derived(p.items ? fromData(p.items) : null)
const full = $derived(p.collection ?? data)
// The draft and tags the results answer: mirrored from the service (the props read them, and
// the machine's view reads the props).
let query = $state("")
let chosen = $state.raw<readonly string[]>([])
let openNow = $state(false)
const live = $derived(
  full
    ? tagSuggestions(
        patternResults(full, query, p.filter, locale),
        chosen,
        p.allowDuplicates === true,
      )
    : NO_ITEMS,
)
// While closing, the listed options are those of the moment it started closing.
let frozen = untrack(() => live)
const results = $derived.by(() => {
  const l = live
  if (openNow) frozen = l
  return openNow || !full ? l : frozen
})
const stale = $derived(isStale({ itemsQuery: p.itemsQuery, query }))
const machineProps = () => ({
  ...(value !== undefined ? { value } : {}),
  defaultValue: defaultValue ?? [],
  ...(inputValue !== undefined ? { inputValue } : {}),
  defaultInputValue,
  delimiter: p.delimiter,
  pasteDelimiter: p.pasteDelimiter,
  addOnPaste: p.addOnPaste,
  normalize: p.normalize,
  allowDuplicates: p.allowDuplicates,
  compare: p.compare,
  max: p.max,
  validate: p.validate,
  onRefuse: (r: TagRefusal) => p.onRefuse?.(r),
  blurBehavior: p.blurBehavior,
  editable: p.editable,
  removeOnBackspace: p.removeOnBackspace,
  disabledKeys,
  disabled: field.disabled,
  readOnly: field.readOnly,
  locale,
  messages,
  items: full ?? undefined,
  collection: results,
  ids,
  strategy: "active-descendant" as const,
  root: instance,
  closeOnSelect: p.closeOnSelect,
  allowCustom: p.allowCustom,
  autoHighlight: p.autoHighlight,
  typingPause: p.typingPause,
  positioning: p.positioning,
  loading: p.loading,
  onLoadMore: p.onLoadMore,
  stale,
  onValueChange: (v: readonly string[], d: { event: { type: string } }) => {
    pending.current = true
    binding?.().report({ type: "change", value: v, user: true, composing: false })
    // A value changed by a text change is always a delimiter split.
    onValueChange?.(v, { reason: reasonOf(d.event.type, true) })
    if (value !== undefined) value = v
  },
  onInputValueChange: (t: string, d: { event: { type: string } }) => {
    onInputValueChange?.(t, { reason: reasonOf(d.event.type, false) })
    if (inputValue !== undefined) inputValue = t
  },
})
const machine = useMachine(tagsInputMachine, machineProps as never, env)
const mirror = () => {
  const v = machine.service.view()
  openNow = v.state === "suggesting"
  query = (v.values.inputValue as string | undefined) ?? ""
  chosen = (v.values.value as readonly string[] | undefined) ?? []
}
$effect(() =>
  untrack(() => {
    mirror()
    return machine.service.subscribe(() => untrack(mirror))
  }),
)
let present = $state(false)
// Known after mount: the server render and hydration never carry `popover`.
let topLayer = $state(false)
$effect(() => {
  topLayer = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
})
const view = $derived(machine.view)
const open = $derived(view.state === "suggesting")
const exposure = $derived({ open, results, query, itemsQuery: p.itemsQuery, loading: p.loading })
const tags = $derived(view.values.value as readonly string[])
const chips = $derived(
  tagChips(
    { ...(machineProps() as object), disabled: field.disabled, readOnly: field.readOnly } as never,
    tags,
  ),
)
$effect(() => {
  if (!binding) return
  return untrack(() =>
    binding().register(
      {
        id: ids.input,
        labelable: true,
        focus: (m) => {
          // Sound: the Input part renders an <input> with this id.
          const el = env.dom.getById(ids.input) as HTMLElement | null
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => constraint,
        value: () => machine.service.view().values.value,
      },
      ids.input,
    ),
  )
})
const formInput = hiddenFormInput(
  {
    input: () => constraint,
    // Sound: the Input part renders an <input> with this id.
    control: () => env.dom.getById(ids.input) as HTMLElement | null,
  },
  env,
)
const modality = useModality(env.modality, () => view.context.focused)
const normalize = $derived(p.normalize ?? ((t: string) => t.trim()))
const api = $derived(
  tagsInputConnect(
    {
      instance,
      state: view.state as "idle" | "typing" | "suggesting" | "editing",
      context: view.context,
      tags,
      chips,
      inputValue: view.values.inputValue as string,
      disabled: field.disabled,
      readOnly: field.readOnly,
      invalid: field.invalid,
      required: field.required,
      atMax: p.max !== undefined && tags.length >= p.max,
      draftNotEmpty: normalize(view.values.inputValue as string) !== "",
      delimiter: p.delimiter ?? ",",
      pasteDelimiter: p.pasteDelimiter,
      addOnPaste: p.addOnPaste !== false,
      modality: modality.current,
      dir: env.locale.dir(),
      locale,
      messages,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      suggestions: full != null,
      results,
      exposed: isExposed(exposure),
      empty: isEmptyState(exposure),
      present: present || open,
      loading: p.loading,
      topLayer,
      name: field.name,
      inputName: p.inputName,
      form: p.form,
      field,
      fieldData: binding?.().data,
      commitSync: (fn) => flushSync(fn),
      send: machine.service.send,
    },
    env,
  ),
)
let loadedFor: Collection<unknown> | null = null
tagsInputHost.set({
  api: () => api,
  chips: () => chips,
  editingKey: () => (view.state === "editing" ? view.context.editingKey : null),
  setDisabled: (key, on) =>
    untrack(() => {
      if (disabledKeys.has(key) === on) return
      const next = new Set(disabledKeys)
      if (on) next.add(key)
      else next.delete(key)
      disabledKeys = next
    }),
  formInput,
  setConstraint: (el) => {
    constraint = el
  },
  pending,
  tags: () => tags,
  reset: () => machine.send({ type: "FORM.RESET" }),
  mountLabel: (on) => mount("label", on),
})
popupHost.set({
  name: "TagsInput",
  api: () => api,
  open: () => open,
  keepMounted: () => p.keepMounted === true,
  setPresent: (v) => {
    present = v
  },
  topLayer: () => topLayer,
  inline: false,
})
listboxHost.set({
  name: "TagsInput",
  // Sound: the tags-input api has every listbox part the shared parts call.
  parts: () => ({ ...api, isEmpty: isEmptyState(exposure) }) as never,
  collection: () => results,
  registry: null,
  listed: (key) => results.has(key),
  mount,
  mountDescription,
  requestLoadMore: () => {
    if ((p.loading ?? "idle") !== "idle" || loadedFor === full) return
    loadedFor = full ?? null
    p.onLoadMore?.()
  },
})
</script>

{@render children?.()}
