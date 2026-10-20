"use client"

// Tags Input (tags-input spec): Root owns the machine and the form inputs; the chips are
// rendered from the value. With suggestions, Root derives the listed ones from the draft
// (patternResults, without the chosen options) and the list parts are the listbox parts
// under scope "tags-input", the popup parts the Combobox's. Wiring only.

import {
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
  mergeFieldProps,
  type PositioningProps,
  patternResults,
  type TagRefusal,
  type TagsInputApi,
  type TagsInputMessages,
  tagChips,
  tagSuggestions,
  tagsInputConnect,
  tagsInputIds,
  tagsInputMachine,
  tagsInputMessages,
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
} from "react"
import { flushSync } from "react-dom"
import { createPopupParts } from "../combobox/popup-parts"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface TagsInputChangeDetails {
  readonly reason: string
}

/** One suggestion of a data-driven Tags Input: choosing it creates the tag `key`. */
export interface TagsInputItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
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
  readonly id?: string
  /** The Tags Input parts (Root renders no element). */
  readonly children?: ReactNode
  readonly value?: readonly string[]
  readonly defaultValue?: readonly string[]
  readonly onValueChange?: (value: readonly string[], details: TagsInputChangeDetails) => void
  readonly inputValue?: string
  readonly defaultInputValue?: string
  readonly onInputValueChange?: (text: string, details: TagsInputChangeDetails) => void
  /** Default ",". Strings match literally. */
  readonly delimiter?: Delimiters
  /** Default: the delimiters plus newline, tab and ";". */
  readonly pasteDelimiter?: Delimiters
  readonly addOnPaste?: boolean
  readonly normalize?: (text: string) => string
  readonly allowDuplicates?: boolean
  readonly compare?: (a: string, b: string) => boolean
  readonly max?: number
  readonly validate?: (text: string, value: readonly string[]) => true | string
  readonly onRefuse?: (refusal: TagRefusal) => void
  readonly blurBehavior?: "keep" | "add" | "clear"
  readonly editable?: boolean
  readonly removeOnBackspace?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly required?: boolean
  readonly name?: string
  readonly inputName?: string
  /** The id of the form the submitted tags (and the named text input) belong to. */
  readonly form?: string
  readonly messages?: Partial<TagsInputMessages>
  /** Suggestions: the input becomes a combobox; choosing one creates a tag from its key. */
  readonly items?: readonly TagsInputItemData[]
  /** Suggestions built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown>
  /** The suggestion matcher; `null` lists them unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter
  /** The draft the given suggestions answer (async): another draft's are stale. */
  readonly itemsQuery?: string
  readonly loading?: LoadingStatus
  /** The suggestions' LoadMore sentinel came into view. */
  readonly onLoadMore?: () => void
  /** Choosing a suggestion closes the popup (default false). */
  readonly closeOnSelect?: boolean
  /** With suggestions, typed text may become a tag (default true). */
  readonly allowCustom?: boolean
  readonly autoHighlight?: boolean
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. Default: 500. */
  readonly typingPause?: number
  readonly positioning?: PositioningProps
  readonly keepMounted?: boolean
}

interface Host extends ListboxHost {
  readonly api: TagsInputApi
  readonly chips: readonly ChipData[]
  readonly editingKey: string | null
  readonly setDisabled: (key: string, on: boolean) => void
  readonly formInput: FormInputCapability
  readonly constraint: RefObject<HTMLInputElement | null>
  readonly pending: RefObject<boolean>
  readonly tags: readonly string[]
  readonly reset: () => void
  readonly open: boolean
  readonly keepMounted: boolean
  readonly setPresent: (present: boolean) => void
  readonly topLayer: boolean
}

const HostContext = createContext<Host | null>(null)
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

function Root(all: TagsInputRootProps) {
  const { id, children } = all
  const base = useEnvironment()
  const env = useMemo(() => ({ ...base, position: domPositioning(base) }), [base])
  const instance = useRootId(id)
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled: all.disabled === true || fieldsetDisabled,
      readOnly: all.readOnly,
      required: all.required,
      invalid: all.invalid,
      name: all.name,
    },
    binding,
  )
  const { disabled, readOnly } = field
  const ids = useMemo(() => tagsInputIds(instance), [instance])
  const locale = env.locale.locale()
  const messages = useMemo(() => ({ ...tagsInputMessages, ...all.messages }), [all.messages])
  const latest = useRef(all)
  latest.current = all
  const pending = useRef(false)
  const constraint = useRef<HTMLInputElement | null>(null)
  const [disabledKeys, setDisabledKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [setDisabled] = useState(
    () => (key: string, on: boolean) =>
      setDisabledKeys((prev) => {
        if (prev.has(key) === on) return prev
        const next = new Set(prev)
        if (on) next.add(key)
        else next.delete(key)
        return next
      }),
  )
  const [mounted, setMounted] = useState<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const [mount] = useState(
    () => (part: "label" | "empty", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const [mountDescription] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setMounted((m) => {
        if (m.descriptions.has(key) === on) return m
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        return { ...m, descriptions: next }
      }),
  )
  // Suggestions: every option, and the listed ones (the draft's, without the chosen tags).
  const data = useMemo(() => (all.items ? fromData(all.items) : null), [all.items])
  const full = all.collection ?? data
  const svc = useRef<{ view(): { state: string; values: Record<string, unknown> } } | null>(null)
  const snapView = svc.current?.view()
  const query = (snapView?.values["inputValue"] as string | undefined) ?? ""
  const chosen = (snapView?.values["value"] as readonly string[] | undefined) ?? []
  const openNow = snapView?.state === "suggesting"
  const live = useMemo(
    () =>
      full
        ? tagSuggestions(
            patternResults(full, query, all.filter, locale),
            chosen,
            all.allowDuplicates === true,
          )
        : NO_ITEMS,
    [full, query, all.filter, locale, chosen, all.allowDuplicates],
  )
  // While closing, the listed options are those of the moment it started closing.
  const frozen = useRef(live)
  if (openNow) frozen.current = live
  const results = openNow || !full ? live : frozen.current
  const stale = isStale({ itemsQuery: all.itemsQuery, query })
  const props = {
    ...("value" in all ? { value: all.value ?? [] } : {}),
    defaultValue: all.defaultValue ?? [],
    ...("inputValue" in all ? { inputValue: all.inputValue } : {}),
    defaultInputValue: all.defaultInputValue,
    delimiter: all.delimiter,
    pasteDelimiter: all.pasteDelimiter,
    addOnPaste: all.addOnPaste,
    normalize: all.normalize,
    allowDuplicates: all.allowDuplicates,
    compare: all.compare,
    max: all.max,
    validate: all.validate,
    onRefuse: (r: TagRefusal) => latest.current.onRefuse?.(r),
    blurBehavior: all.blurBehavior,
    editable: all.editable,
    removeOnBackspace: all.removeOnBackspace,
    disabledKeys,
    disabled,
    readOnly,
    locale,
    messages,
    items: full ?? undefined,
    collection: results,
    ids,
    strategy: "active-descendant",
    root: instance,
    closeOnSelect: all.closeOnSelect,
    allowCustom: all.allowCustom,
    autoHighlight: all.autoHighlight,
    typingPause: all.typingPause,
    positioning: all.positioning,
    loading: all.loading,
    onLoadMore: all.onLoadMore,
    stale,
    onValueChange: (v: readonly string[], d: { event: { type: string } }) => {
      pending.current = true
      binding?.report({ type: "change", value: v, user: true, composing: false })
      // A value changed by a text change is always a delimiter split.
      latest.current.onValueChange?.(v, { reason: reasonOf(d.event.type, true) })
    },
    onInputValueChange: (t: string, d: { event: { type: string } }) =>
      latest.current.onInputValueChange?.(t, { reason: reasonOf(d.event.type, false) }),
  }
  const { service } = useMachine(tagsInputMachine, props as never, env as never)
  svc.current = service as never
  const view = service.view()
  const open = view.state === "suggesting"
  const [present, setPresent] = useState(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = useState(false)
  useEffect(() => {
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype)
  }, [])
  const exposure = { open, results, query, itemsQuery: all.itemsQuery, loading: all.loading }
  const tags = view.values.value as readonly string[]
  const chips = tagChips({ ...props, disabled, readOnly }, tags)
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: ids.input,
        labelable: true,
        focus: (m) => {
          // Sound: the Input part renders an <input> with this id.
          const el = env.dom.getById(ids.input) as HTMLElement | null
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => constraint.current,
        value: () => service.view().values.value,
      },
      ids.input,
    )
  }, [register, ids.input, env, service])
  const formInput = useMemo(
    () =>
      hiddenFormInput(
        {
          input: () => constraint.current,
          // Sound: the Input part renders an <input> with this id.
          control: () => env.dom.getById(ids.input) as HTMLElement | null,
        },
        env,
      ),
    [env, ids.input],
  )
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const normalize = all.normalize ?? ((t: string) => t.trim())
  const api = tagsInputConnect(
    {
      instance,
      state: view.state as "idle" | "typing" | "suggesting" | "editing",
      context: view.context,
      tags,
      chips,
      inputValue: view.values.inputValue as string,
      disabled,
      readOnly,
      invalid: field.invalid,
      required: field.required,
      atMax: all.max !== undefined && tags.length >= all.max,
      draftNotEmpty: normalize(view.values.inputValue as string) !== "",
      delimiter: all.delimiter ?? ",",
      pasteDelimiter: all.pasteDelimiter,
      addOnPaste: all.addOnPaste !== false,
      modality,
      dir: env.locale.dir(),
      locale,
      messages,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      suggestions: full !== null,
      results,
      exposed: isExposed(exposure),
      empty: isEmptyState(exposure),
      present: present || open,
      loading: all.loading,
      topLayer,
      name: field.name,
      inputName: all.inputName,
      form: all.form,
      field,
      fieldData: binding?.data,
      commitSync: (fn) => flushSync(fn),
      send: service.send,
    },
    env,
  )
  const loadedFor = useRef<Collection<unknown> | null>(null)
  const host: Host = {
    name: "TagsInput",
    // Sound: the tags-input api has every listbox part the shared React parts call.
    parts: { ...api, isEmpty: isEmptyState(exposure) } as unknown as ListboxHost["parts"],
    collection: results,
    registry: null,
    listed: (key: CollectionKey) => results.has(key),
    mountDescription,
    requestLoadMore: () => {
      if ((all.loading ?? "idle") !== "idle" || loadedFor.current === full) return
      loadedFor.current = full
      all.onLoadMore?.()
    },
    itemSignature: (raw, key) => {
      // Sound: this host's service is the tags-input machine's.
      const v = raw as ReturnType<typeof service.view>
      const c = v.context
      const highlighted = c.highlightedKey === key
      return [
        highlighted,
        highlighted ? c.highlightSource : null,
        v.state === "suggesting",
        results.has(key),
        results.get(key)?.setIndex,
        results.size,
      ].join("|")
    },
    open,
    keepMounted: all.keepMounted === true,
    setPresent,
    topLayer,
    api,
    chips,
    editingKey: view.state === "editing" ? view.context.editingKey : null,
    service: service as never,
    mount,
    setDisabled,
    formInput,
    constraint,
    pending,
    tags,
    reset: () => service.send({ type: "FORM.RESET" }),
  }
  return <HostContext value={host}>{children}</HostContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

function useLive(part: string) {
  const host = useHost(part)
  useSelector(host.service, (v) => v)
  return host
}

function Label({ render, ...rest }: Own<"label">) {
  const host = useLive("Label")
  const { mount } = host
  useIsoLayoutEffect(() => {
    mount("label", true)
    return () => mount("label", false)
  }, [mount])
  return renderPart("label", mergeProps(normalizeProps(host.api.label()), rest), render, undefined)
}

function Control({ render, children, ...rest }: Own<"div">) {
  const host = useLive("Control")
  const { formInput, pending, tags, reset } = host
  const latest = useRef(tags)
  latest.current = tags
  // The carriers reflect every change; a user change dispatches input and change.
  useIsoLayoutEffect(() => {
    formInput.sync({ values: tags }, { dispatch: pending.current })
    pending.current = false
  })
  useEffect(
    () => formInput.track({ onReset: reset, current: () => ({ values: latest.current }) }),
    [formInput, reset],
  )
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(host.api.control()), rest),
      children: (
        <>
          {children}
          <span {...normalizeProps(host.api.chipsSummary())}>{host.api.summaryText}</span>
          <input {...normalizeProps(host.api.hiddenInput())} ref={host.constraint} />
          {host.api.carriers().map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: carriers are positional (duplicates allowed)
            <input key={i} {...normalizeProps(p)} />
          ))}
        </>
      ),
    },
    render,
    undefined,
  )
}

function Input({ render, ...rest }: Own<"input">) {
  const host = useLive("Input")
  return renderPart("input", mergeProps(normalizeProps(host.api.input()), rest), render, undefined)
}

const ChipCtx = createContext<ChipData | null>(null)

/** The chips toolbar: one Chip per tag, before the Input. */
function Chips({
  render,
  children,
  ...rest
}: Omit<Own<"div">, "children"> & {
  /** Renders one chip; default: ChipText, ChipInput while edited, and ChipRemove. */
  readonly children?: (chip: ChipData) => ReactNode
}) {
  const host = useLive("Chips")
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(host.api.chips()), rest),
      children: host.chips.map((chip) => (
        <ChipCtx key={chip.key} value={chip}>
          {children ? (
            children(chip)
          ) : (
            <Chip>
              <ChipText />
              <ChipInput />
              <ChipRemove />
            </Chip>
          )}
        </ChipCtx>
      )),
    },
    render,
    undefined,
  )
}

const useChip = (part: string) => {
  const chip = useContext(ChipCtx)
  if (chip === null) throw new Error(`TagsInput.${part} must be inside TagsInput.Chips`)
  return chip
}

function Chip({
  render,
  disabled,
  ...rest
}: Own<"span"> & {
  /** Locks this tag: it cannot be edited or removed, and clearing keeps it. */
  readonly disabled?: boolean
}) {
  const host = useLive("Chip")
  const chip = useChip("Chip")
  const { setDisabled } = host
  useIsoLayoutEffect(() => {
    setDisabled(chip.key, disabled === true)
    return () => setDisabled(chip.key, false)
  }, [setDisabled, chip.key, disabled])
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.api.chip(chip.key)), rest),
    render,
    undefined,
  )
}

function ChipText({ render, children, ...rest }: Own<"span">) {
  const host = useLive("ChipText")
  const chip = useChip("ChipText")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.api.chipText(chip.key)), {
      ...rest,
      children: children ?? chip.text,
    }),
    render,
    undefined,
  )
}

/** The edit input: rendered only while its chip is edited. */
function ChipInput({ render, ...rest }: Own<"input">) {
  const host = useLive("ChipInput")
  const chip = useChip("ChipInput")
  if (host.editingKey !== chip.key) return null
  return renderPart(
    "input",
    mergeProps(normalizeProps(host.api.chipInput(chip.key)), rest),
    render,
    undefined,
  )
}

function ChipRemove({ render, children, ...rest }: Own<"button">) {
  const host = useLive("ChipRemove")
  const chip = useChip("ChipRemove")
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

function ClearTrigger({ render, ...rest }: Own<"button">) {
  const host = useLive("ClearTrigger")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.clearTrigger()), rest),
    render,
    undefined,
  )
}

const list = createListboxParts(useHost)
const popup = createPopupParts(useLive)

// A pure call around the object: reading `list.Item` could run a getter as far as a bundler
// knows, so a plain object literal would stay in every bundle that reaches this module.
export const TagsInput = /* @__PURE__ */ (() => ({
  Root,
  Label,
  Control,
  Chips,
  Chip,
  ChipText,
  ChipInput,
  ChipRemove,
  Input,
  ClearTrigger,
  Positioner: popup.Positioner,
  Popup: popup.Popup,
  List: list.List,
  Item: list.Item,
  ItemText: list.ItemText,
  Group: list.Section,
  Separator: list.Separator,
  Empty: list.Empty,
  Items: list.Items,
}))()
