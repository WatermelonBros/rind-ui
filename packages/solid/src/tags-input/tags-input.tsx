/** @jsxImportSource solid-js */
// Tags Input (tags-input spec): Root owns the machine and the form inputs; the chips are
// rendered from the value. With suggestions, Root derives the listed ones from the draft
// (patternResults, without the chosen options) and the list parts are the listbox parts
// under scope "tags-input", the popup parts the Combobox's. Wiring only.
import {
  announcerCapability,
  type Chip as ChipData,
  type Collection,
  type CollectionKey,
  type ComboboxFilter,
  createListCollection,
  type Delimiters,
  domPositioning,
  type FormInputCapability,
  focusSafely,
  hiddenFormInput,
  isEmptyState,
  isExposed,
  isStale,
  type LoadingStatus,
  layoutCapability,
  mergeFieldProps,
  type PositioningProps,
  patternResults,
  type TagRefusal,
  type TagsInputMessages,
  tagChips,
  tagSuggestions,
  tagsInputConnect,
  tagsInputIds,
  tagsInputMachine,
  tagsInputMessages,
  userTagsChange,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { createPopupParts } from "../combobox/popup-parts"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

export interface TagsInputChangeDetails {
  readonly reason: string
}

/** One suggestion of a data-driven Tags Input: choosing it creates the tag `key`. */
export interface TagsInputItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean | undefined
  readonly section?: { readonly key: string; readonly label: string } | undefined
}

const fromData = (items: readonly TagsInputItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const NO_ITEMS = fromData([])

export interface TagsInputRootProps {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  /** The Tags Input parts (Root renders no element). */
  readonly children?: JSX.Element
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: TagsInputChangeDetails) => void)
    | undefined
  readonly inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: TagsInputChangeDetails) => void)
    | undefined
  /** Default ",". Strings match literally. */
  readonly delimiter?: Delimiters | undefined
  /** Default: the delimiters plus newline, tab and ";". */
  readonly pasteDelimiter?: Delimiters | undefined
  readonly addOnPaste?: boolean | undefined
  readonly normalize?: ((text: string) => string) | undefined
  readonly allowDuplicates?: boolean | undefined
  readonly compare?: ((a: string, b: string) => boolean) | undefined
  readonly max?: number | undefined
  readonly validate?: ((text: string, value: readonly string[]) => true | string) | undefined
  readonly onRefuse?: ((refusal: TagRefusal) => void) | undefined
  readonly blurBehavior?: "keep" | "add" | "clear" | undefined
  readonly editable?: boolean | undefined
  readonly removeOnBackspace?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly required?: boolean | undefined
  readonly name?: string | undefined
  readonly inputName?: string | undefined
  /** The id of the form the submitted tags (and the named text input) belong to. */
  readonly form?: string | undefined
  readonly messages?: Partial<TagsInputMessages> | undefined
  /** Suggestions: the input becomes a combobox; choosing one creates a tag from its key. */
  readonly items?: readonly TagsInputItemData[] | undefined
  /** Suggestions built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown> | undefined
  /** The suggestion matcher; `null` lists them unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter | undefined
  /** The draft the given suggestions answer (async): another draft's are stale. */
  readonly itemsQuery?: string | undefined
  readonly loading?: LoadingStatus | undefined
  /** The suggestions' LoadMore sentinel came into view. */
  readonly onLoadMore?: (() => void) | undefined
  /** Choosing a suggestion closes the popup (default false). */
  readonly closeOnSelect?: boolean | undefined
  /** With suggestions, typed text may become a tag (default true). */
  readonly allowCustom?: boolean | undefined
  readonly autoHighlight?: boolean | undefined
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. Default: 500. */
  readonly typingPause?: number | undefined
  readonly positioning?: PositioningProps | undefined
  readonly keepMounted?: boolean | undefined
}

type Api = ReturnType<typeof tagsInputConnect>

interface Host extends ListboxHost {
  readonly api: Accessor<Api>
  readonly chips: Accessor<readonly ChipData[]>
  readonly editingKey: Accessor<string | null>
  readonly setDisabled: (key: string, on: boolean) => void
  readonly formInput: FormInputCapability
  readonly constraint: Accessor<HTMLInputElement | null>
  readonly setConstraint: (el: HTMLInputElement | null) => void
  /** A user change happened since the last sync (the hidden input dispatches events). */
  readonly pending: { current: boolean }
  readonly tags: Accessor<readonly string[]>
  readonly reset: () => void
  readonly open: Accessor<boolean>
  readonly keepMounted: Accessor<boolean>
  readonly setPresent: (present: boolean) => void
  readonly topLayer: Accessor<boolean>
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`TagsInput.${part} must be inside TagsInput.Root`)
  return host
}

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

export function Root(all: TagsInputRootProps) {
  const p = all
  const base = useEnvironment(announcerCapability, layoutCapability)
  const env = { ...base, position: domPositioning(base) }
  const instance = useRootId(() => p.id)
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = createMemo(() =>
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
  const ids = createMemo(() => tagsInputIds(instance()))
  const locale = () => env.locale.locale()
  const messages = createMemo(() => ({ ...tagsInputMessages, ...p.messages }))
  const pending = { current: false }
  const [constraint, setConstraint] = createSignal<HTMLInputElement | null>(null)
  const [disabledKeys, setDisabledKeys] = createSignal<ReadonlySet<string>>(new Set())
  const setDisabled = (key: string, on: boolean) =>
    setDisabledKeys((prev) => {
      if (prev.has(key) === on) return prev
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const [mounted, setMounted] = createSignal<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const mount = (part: "label" | "empty", on: boolean) =>
    setMounted((m) => (m[part] === on ? m : { ...m, [part]: on }))
  const mountDescription = (key: CollectionKey, on: boolean) =>
    setMounted((m) => {
      if (m.descriptions.has(key) === on) return m
      const next = new Set(m.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      return { ...m, descriptions: next }
    })
  // Suggestions: every option, and the listed ones (the draft's, without the chosen tags).
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const full = () => p.collection ?? data()
  // The draft and the tags the results answer: mirrored from the service (the props read
  // them, and the view reads the props).
  const [query, setQuery] = createSignal("")
  const [chosen, setChosen] = createSignal<readonly string[]>([])
  const [openNow, setOpenNow] = createSignal(false)
  const live = createMemo(() => {
    const f = full()
    return f
      ? tagSuggestions(
          patternResults(f, query(), p.filter, locale()),
          chosen(),
          p.allowDuplicates === true,
        )
      : NO_ITEMS
  })
  // While closing, the listed options are those of the moment it started closing.
  let frozen = untrack(live)
  const results = createMemo(() => {
    const l = live()
    if (openNow()) frozen = l
    return openNow() || !full() ? l : frozen
  })
  const machineProps = () => ({
    ...("value" in all ? { value: p.value ?? [] } : {}),
    defaultValue: p.defaultValue ?? [],
    ...("inputValue" in all ? { inputValue: p.inputValue } : {}),
    defaultInputValue: p.defaultInputValue,
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
    disabledKeys: disabledKeys(),
    disabled: field().disabled,
    readOnly: field().readOnly,
    locale: locale(),
    messages: messages(),
    items: full() ?? undefined,
    collection: results(),
    ids: ids(),
    strategy: "active-descendant" as const,
    root: instance(),
    closeOnSelect: p.closeOnSelect,
    allowCustom: p.allowCustom,
    autoHighlight: p.autoHighlight,
    typingPause: p.typingPause,
    positioning: p.positioning,
    loading: p.loading,
    onLoadMore: p.onLoadMore,
    stale: isStale({ itemsQuery: p.itemsQuery, query: query() }),
    onValueChange: (v: readonly string[], d: { event: { type: string } }) => {
      pending.current = true
      binding?.().report({
        type: "change",
        value: v,
        user: userTagsChange(d.event.type),
        composing: false,
      })
      // A value changed by a text change is always a delimiter split.
      p.onValueChange?.(v, { reason: reasonOf(d.event.type, true) })
    },
    onInputValueChange: (t: string, d: { event: { type: string } }) =>
      p.onInputValueChange?.(t, { reason: reasonOf(d.event.type, false) }),
  })
  const { view, service } = useMachine(tagsInputMachine, machineProps as never, env)
  const mirror = () => {
    const v = service.view()
    setOpenNow(v.state === "suggesting")
    setQuery((v.values.inputValue as string | undefined) ?? "")
    setChosen((v.values.value as readonly string[] | undefined) ?? [])
  }
  mirror()
  afterMount(() => {
    mirror()
    onCleanup(service.subscribe(mirror))
  })
  const open = () => view().state === "suggesting"
  const [present, setPresent] = createSignal(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = createSignal(false)
  afterMount(() =>
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype),
  )
  const exposure = () => ({
    open: open(),
    results: results(),
    query: query(),
    itemsQuery: p.itemsQuery,
    loading: p.loading,
  })
  const tags = () => view().values.value as readonly string[]
  const chips = createMemo(() =>
    tagChips(
      { ...machineProps(), disabled: field().disabled, readOnly: field().readOnly } as never,
      tags(),
    ),
  )
  afterMount(() => {
    if (!binding) return
    createEffect(() => {
      const id = ids().input
      onCleanup(
        untrack(() =>
          binding().register(
            {
              id,
              labelable: true,
              focus: (m) => {
                // Sound: the Input part renders an <input> with this id.
                const el = env.dom.getById(id) as HTMLElement | null
                if (el) void focusSafely(el, env, "programmatic", m)
              },
              validityElement: () => constraint(),
              value: () => service.view().values.value,
            },
            id,
          ),
        ),
      )
    })
  })
  const formInput = hiddenFormInput(
    {
      input: constraint,
      // Sound: the Input part renders an <input> with this id.
      control: () => env.dom.getById(untrack(ids).input) as HTMLElement | null,
    },
    env,
  )
  const modality = useModality(env.modality, () => view().context.focused)
  const api = createMemo(() => {
    const v = view()
    const f = field()
    const m = mounted()
    const t = tags()
    const normalize = p.normalize ?? ((s: string) => s.trim())
    return tagsInputConnect(
      {
        instance: instance(),
        state: v.state as "idle" | "typing" | "suggesting" | "editing",
        context: v.context,
        tags: t,
        chips: chips(),
        inputValue: v.values.inputValue as string,
        disabled: f.disabled,
        readOnly: f.readOnly,
        invalid: f.invalid,
        required: f.required,
        atMax: p.max !== undefined && t.length >= p.max,
        draftNotEmpty: normalize(v.values.inputValue as string) !== "",
        delimiter: p.delimiter ?? ",",
        pasteDelimiter: p.pasteDelimiter,
        addOnPaste: p.addOnPaste !== false,
        modality: modality(),
        dir: env.locale.dir(),
        locale: locale(),
        messages: messages(),
        mounted: {
          label: m.label,
          empty: m.empty,
          description: (key) => m.descriptions.has(key),
        },
        suggestions: full() != null,
        results: results(),
        exposed: isExposed(exposure()),
        empty: isEmptyState(exposure()),
        present: present() || open(),
        loading: p.loading,
        topLayer: topLayer(),
        name: f.name,
        inputName: p.inputName,
        form: p.form,
        field: f,
        fieldData: binding?.().data,
        // Solid updates synchronously: the edit input exists right after the commit.
        commitSync: (fn) => fn(),
        send: service.send,
      },
      env,
    )
  })
  let loadedFor: Collection<unknown> | null = null
  const host: Host = {
    name: "TagsInput",
    // Sound: the tags-input api has every listbox part the shared parts call.
    parts: createMemo(
      () =>
        ({ ...api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
    ),
    collection: results,
    registry: null,
    listed: (key: CollectionKey) => results().has(key),
    mount,
    mountDescription,
    requestLoadMore: () => {
      if ((p.loading ?? "idle") !== "idle" || loadedFor === full()) return
      loadedFor = full() ?? null
      p.onLoadMore?.()
    },
    api,
    chips,
    editingKey: () => (view().state === "editing" ? view().context.editingKey : null),
    setDisabled,
    formInput,
    constraint,
    setConstraint,
    pending,
    tags,
    reset: () => service.send({ type: "FORM.RESET" }),
    open,
    keepMounted: () => p.keepMounted === true,
    setPresent,
    topLayer,
  }
  return <HostContext.Provider value={host}>{p.children}</HostContext.Provider>
}

type Own<A, C = JSX.Element> = Omit<A, "children"> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: C
}

export function Label(props: Own<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Label")
  createEffect(() => {
    host.mount("label", true)
    onCleanup(() => host.mount("label", false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().label()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` is the input's id (connect)
    <label {...p}>{children()}</label>
  ))
}

export function Control(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Control")
  // The carriers reflect every change; a user change dispatches input and change.
  afterMount(() => {
    createEffect(() => {
      host.constraint()
      const values = host.tags()
      host.formInput.sync({ values }, { dispatch: host.pending.current })
      host.pending.current = false
    })
    createEffect(() => {
      onCleanup(
        host.formInput.track({
          onReset: host.reset,
          current: () => ({ values: untrack(host.tags) }),
        }),
      )
    })
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().control()), rest))
  const carriers = createMemo(() => host.api().carriers())
  const children = () => (
    <>
      {local.children}
      <span {...normalizeProps(host.api().chipsSummary())}>{host.api().summaryText}</span>
      <input {...normalizeProps(host.api().hiddenInput())} ref={host.setConstraint} />
      {/* Positional: duplicates are allowed. */}
      <Index each={carriers()}>{(c) => <input {...normalizeProps(c())} />}</Index>
    </>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** A controlled text input: like React's, the `value` attribute follows the text. */
function withValueAttr(own: Record<string | symbol, unknown>) {
  if (typeof own["value"] === "string") own["attr:value"] = own["value"]
  return own
}

export function Input(props: Own<JSX.InputHTMLAttributes<HTMLInputElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Input")
  const merged = createMemo(() =>
    mergeProps(withValueAttr(normalizeProps(host.api().input())), rest),
  )
  return renderPart(
    local.render,
    merged,
    undefined,
    () => undefined,
    (p) => <input {...p} />,
  )
}

export function ClearTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ClearTrigger")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().clearTrigger()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

const ChipCtx = createContext<ChipData>()
const useChip = (part: string) => {
  const chip = useContext(ChipCtx)
  if (chip === undefined) throw new Error(`TagsInput.${part} must be inside TagsInput.Chips`)
  return chip
}

export function Chip(
  props: Own<JSX.HTMLAttributes<HTMLSpanElement>> & {
    /** Locks this tag: it cannot be edited or removed, and clearing keeps it. */
    readonly disabled?: boolean | undefined
  },
) {
  const [local, rest] = splitProps(props, ["render", "children", "disabled"])
  const host = useHost("Chip")
  const chip = useChip("Chip")
  createEffect(() => {
    const key = chip.key
    host.setDisabled(key, local.disabled === true)
    onCleanup(() => host.setDisabled(key, false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chip(chip.key)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export function ChipText(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ChipText")
  const chip = useChip("ChipText")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipText(chip.key)), rest))
  const children = () => local.children ?? chip.text
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The edit input: rendered only while its chip is edited. */
export function ChipInput(props: Own<JSX.InputHTMLAttributes<HTMLInputElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ChipInput")
  const chip = useChip("ChipInput")
  const merged = createMemo(() =>
    mergeProps(withValueAttr(normalizeProps(host.api().chipInput(chip.key))), rest),
  )
  return (
    <Show when={host.editingKey() === chip.key}>
      {untrack(() =>
        renderPart(
          local.render,
          merged,
          undefined,
          () => undefined,
          (p) => <input {...p} />,
        ),
      )}
    </Show>
  )
}

export function ChipRemove(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ChipRemove")
  const chip = useChip("ChipRemove")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipRemove(chip.key)), rest))
  const children = () => local.children ?? <span aria-hidden="true">×</span>
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The chips toolbar: one Chip per tag, before the Input. */
export function Chips(
  props: Own<JSX.HTMLAttributes<HTMLDivElement>, (chip: ChipData) => JSX.Element>,
) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Chips")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chips()), rest))
  // One scope per key: a change of the tags keeps the other chips mounted.
  const chipKeys = createMemo(() => host.chips().map((c) => c.key), [], {
    equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
  })
  const children = () => (
    <For each={chipKeys()}>
      {(key) => {
        let last = host.chips().find((c) => c.key === key) as ChipData
        const chip = reactive<ChipData>(() => {
          last = host.chips().find((c) => c.key === key) ?? last
          return last
        })
        return (
          <ChipCtx.Provider value={chip}>
            {local.children ? (
              local.children(chip)
            ) : (
              <Chip>
                <ChipText />
                <ChipInput />
                <ChipRemove />
              </Chip>
            )}
          </ChipCtx.Provider>
        )
      }}
    </For>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const popup = createPopupParts(useHost)
const { Positioner, Popup } = popup
const list = createListboxParts(useHost)
const { List, Item, ItemText, Section: Group, Separator, Empty, Items } = list

export { Empty, Group, Item, Items, ItemText, List, Popup, Positioner, Separator }
