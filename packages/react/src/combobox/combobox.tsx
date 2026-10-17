// Combobox (combobox + combobox-pattern specs): Root derives the listed results from the
// snapshot (patternResults) and passes them as the machine's collection; the list parts are
// the listbox parts under scope "combobox". Wiring only.

import {
  type Collection,
  type CollectionKey,
  type ComboboxApi,
  type ComboboxFilter,
  type ComboboxMessages,
  type ComboboxValue,
  comboboxConnect,
  comboboxIds,
  comboboxMachine,
  comboboxMessages,
  createListCollection,
  domPositioning,
  type FormInputCapability,
  hiddenFormInput,
  isEmptyState,
  isExposed,
  isStale,
  type LoadingStatus,
  type PositioningProps,
  patternQuery,
  patternResults,
  type ScrollToIndexDetails,
  type Service,
  selectionOf,
  toKey,
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
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionIdentityWarning, useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** One option of a data-driven combobox. */
export interface ComboboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

const fromData = (items: readonly ComboboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

export interface ComboboxChangeDetails {
  readonly reason: string
}

interface Common {
  readonly id?: string
  readonly children?: ReactNode
  readonly items?: readonly ComboboxItemData[]
  /** A collection built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown>
  readonly inputValue?: string
  readonly defaultInputValue?: string
  readonly onInputValueChange?: (text: string, details: ComboboxChangeDetails) => void
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: ComboboxChangeDetails) => void
  readonly allowCustomValue?: boolean
  readonly closeOnSelect?: boolean
  readonly clearInputOnSelect?: boolean
  readonly selectOnTab?: boolean
  readonly openOnInput?: boolean
  readonly openOnArrow?: boolean
  readonly openOnInputPress?: boolean
  readonly openOnFocus?: boolean
  readonly autoHighlight?: boolean
  readonly keepHighlight?: boolean
  readonly autoComplete?: "list" | "both"
  /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter
  /** The query the given collection answers (async): another query's results are stale. */
  readonly itemsQuery?: string
  readonly loading?: LoadingStatus
  readonly onLoadMore?: () => void
  readonly virtualized?: boolean
  readonly scrollToIndex?: (details: ScrollToIndexDetails) => void
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly required?: boolean
  readonly disallowEmptySelection?: boolean
  readonly loop?: boolean
  readonly messages?: Partial<ComboboxMessages>
  readonly positioning?: PositioningProps
  readonly keepMounted?: boolean
  readonly typingPause?: number
  /** The form name of the selected key(s); the visible text is not submitted. */
  readonly name?: string
  /** Submits the visible text under this name too. */
  readonly inputName?: string
  readonly form?: string
}

type Selection =
  | {
      readonly multiple?: false
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: ComboboxChangeDetails) => void
    }
  | {
      readonly multiple: true
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: ComboboxChangeDetails) => void
    }

export type ComboboxRootProps = Common & Selection

interface ComboboxHost extends ListboxHost {
  readonly api: ComboboxApi
  readonly keys: readonly string[]
  readonly formInput: FormInputCapability
  readonly constraint: RefObject<HTMLInputElement | null>
  /** A user change happened since the last sync (the hidden input dispatches events). */
  readonly pending: RefObject<boolean>
  readonly reset: () => void
  readonly autofill: (text: string) => boolean
  readonly keepMounted: boolean
  readonly open: boolean
  readonly setPresent: (present: boolean) => void
}

const HostContext = createContext<ComboboxHost | null>(null)
const useComboboxHost = (part: string): ComboboxHost => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Combobox.${part} must be inside Combobox.Root`)
  return host
}

/** The event that changed a value, as the public reason. */
const reasonOf = (type: string) =>
  ({
    "ITEM.CHOOSE": "item-press",
    ENTER: "enter",
    "CLEAR.PRESS": "clear",
    CLEAR: "clear",
    RESET: "reset",
    "INPUT.CHANGE": "input-change",
    "COMPOSITION.END": "input-change",
    ESCAPE: "escape",
    TAB: "commit",
    "INPUT.BLUR": "commit",
    OUTSIDE_PRESS: "commit",
  })[type] ?? type.toLowerCase()

function Root(all: ComboboxRootProps) {
  const { id, items, collection: given, children, disabled = false } = all
  const p = all as Record<string, unknown>
  const base = useEnvironment()
  const env = useMemo(() => ({ ...base, position: domPositioning(base) }), [base])
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const full = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(full, "Combobox")
  const multiple = all.multiple === true
  const selectionMode = multiple ? "multiple" : "single"
  const ids = useMemo(() => comboboxIds(instance), [instance])
  const locale = env.locale.locale()
  const messages = useMemo(() => ({ ...comboboxMessages, ...all.messages }), [all.messages])
  const latest = useRef(all)
  latest.current = all
  const pending = useRef(false)
  const constraint = useRef<HTMLInputElement | null>(null)

  // The selection's text is the initial text (no change callback for it at mount).
  const [initialText] = useState(() => {
    if (all.defaultInputValue !== undefined) return all.defaultInputValue
    const v = (p["value"] ?? p["defaultValue"]) as ComboboxValue | undefined
    return typeof v === "string" && !multiple ? (full.get(toKey(v))?.textValue ?? "") : ""
  })
  // The results answer the snapshot's query (read before the props are committed).
  const svc = useRef<Service<typeof comboboxMachine> | null>(null)
  const snap = svc.current?.getSnapshot()
  const openNow = snap?.state === "open"
  const query = snap
    ? patternQuery({
        inputValue: svc.current?.view().values.inputValue ?? "",
        dirty: snap.context.dirty,
        openReason: snap.context.openReason,
      })
    : ""
  const live = useMemo(
    () => patternResults(full, query, all.filter, locale),
    [full, query, all.filter, locale],
  )
  // While closing, the listed options are those of the moment it started closing.
  const frozen = useRef(live)
  if (openNow) frozen.current = live
  const results = openNow ? live : frozen.current
  const stale = isStale({ itemsQuery: all.itemsQuery, query })

  const { service } = useMachine(
    comboboxMachine,
    {
      items: full,
      collection: results,
      ids,
      strategy: "active-descendant",
      selectionMode,
      disabled,
      readOnly: all.readOnly,
      disallowEmptySelection: all.disallowEmptySelection,
      loop: all.loop,
      loading: all.loading,
      onLoadMore: all.onLoadMore,
      virtualized: all.virtualized,
      scrollToIndex: all.scrollToIndex,
      allowCustomValue: all.allowCustomValue,
      closeOnSelect: all.closeOnSelect,
      clearInputOnSelect: all.clearInputOnSelect,
      selectOnTab: all.selectOnTab,
      openOnInput: all.openOnInput,
      openOnArrow: all.openOnArrow,
      openOnInputPress: all.openOnInputPress,
      openOnFocus: all.openOnFocus,
      autoHighlight: all.autoHighlight,
      keepHighlight: all.keepHighlight,
      autoComplete: all.autoComplete,
      locale,
      messages,
      root: instance,
      positioning: all.positioning,
      stale,
      typingPause: all.typingPause,
      ...("value" in all ? { value: (p["value"] as ComboboxValue | undefined) ?? null } : {}),
      defaultValue: (p["defaultValue"] as ComboboxValue | undefined) ?? (multiple ? [] : null),
      ...("inputValue" in all ? { inputValue: all.inputValue } : {}),
      defaultInputValue: initialText,
      ...("open" in all ? { open: all.open } : {}),
      defaultOpen: all.defaultOpen,
      onValueChange: (v, d) => {
        pending.current = true
        const cb = latest.current.onValueChange as ((v: unknown, d: unknown) => void) | undefined
        cb?.(v, { reason: reasonOf(d.event.type) })
      },
      onInputValueChange: (t, d) =>
        latest.current.onInputValueChange?.(t, { reason: reasonOf(d.event.type) }),
      onOpenChange: (o, d) => latest.current.onOpenChange?.(o, { reason: reasonOf(d.event.type) }),
    },
    env,
  )
  svc.current = service
  const view = service.view()
  const open = view.matches("open")
  const [present, setPresent] = useState(false)
  const [mounted, setMounted] = useState({ label: false, empty: false })
  const [mount] = useState(
    () => (part: "label" | "empty", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const exposure = {
    open,
    results,
    query,
    itemsQuery: all.itemsQuery,
    loading: all.loading,
  }
  const value = view.values.value as ComboboxValue
  const keys = value == null ? [] : typeof value === "string" ? [value] : value
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
  const api = comboboxConnect(
    {
      instance,
      open,
      exposed: isExposed(exposure),
      empty: isEmptyState(exposure),
      present: present || open,
      results,
      context: view.context,
      selection: selectionOf(value),
      selectionMode,
      inputValue: view.values.inputValue as string,
      hasValue: Array.isArray(value) ? value.length > 0 : value != null,
      disabled,
      readOnly: all.readOnly === true,
      invalid: all.invalid === true,
      required: all.required === true,
      autoComplete: all.autoComplete ?? "list",
      loading: all.loading,
      modality,
      dir: env.locale.dir(),
      messages,
      mounted,
      name: all.name,
      inputName: all.inputName,
      form: all.form,
      keys,
      send: service.send,
    },
    env,
  )
  const loadedFor = useRef<Collection<unknown> | null>(null)
  const host: ComboboxHost = {
    name: "Combobox",
    // Sound: the combobox api has every listbox part the shared React parts call.
    parts: { ...api, isEmpty: isEmptyState(exposure) } as unknown as ListboxHost["parts"],
    api,
    collection: results,
    registry: given || data ? null : registry,
    listed: (key: CollectionKey) => results.has(key),
    mount,
    mountDescription: () => {},
    requestLoadMore: () => {
      if ((all.loading ?? "idle") !== "idle" || loadedFor.current === full) return
      loadedFor.current = full
      all.onLoadMore?.()
    },
    service: service as unknown as ListboxHost["service"],
    itemSignature: (raw, key) => {
      // Sound: this host's service is the combobox machine's.
      const v = raw as ReturnType<typeof service.view>
      const c = v.context
      const highlighted = c.highlightedKey === key
      return [
        highlighted,
        highlighted ? c.highlightSource : null,
        JSON.stringify(v.values.value),
        v.matches("open"),
        results.has(key),
        results.get(key)?.setIndex,
        results.size,
      ].join("|")
    },
    keepMounted: all.keepMounted === true,
    keys,
    formInput,
    constraint,
    pending,
    reset: () => service.send({ type: "RESET" }),
    autofill: (text) => {
      const before = service.view().values.value
      service.send({ type: "AUTOFILL", text })
      return service.view().values.value !== before
    },
    open,
    setPresent,
  }
  return <HostContext value={host}>{children}</HostContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<undefined>
}

/** Re-renders on every snapshot (the combobox parts read most of it). */
function useLive(part: string) {
  const host = useComboboxHost(part)
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
  const { formInput, pending, keys, reset, autofill } = host
  const latest = useRef(keys)
  latest.current = keys
  // After every commit the constraint input mirrors the selection; a user change dispatches.
  useIsoLayoutEffect(() => {
    formInput.sync({ values: keys }, { dispatch: pending.current })
    pending.current = false
  })
  useEffect(
    () =>
      formInput.track({
        onReset: reset,
        current: () => ({ values: latest.current }),
        onNativeInput: (input) => autofill(input.value),
      }),
    [formInput, reset, autofill],
  )
  const props = mergeProps(normalizeProps(host.api.control()), rest)
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <>
          {children}
          {/* Inside the Control: the browser's validation message is anchored near it. */}
          <input {...normalizeProps(host.api.hiddenInput())} ref={host.constraint} />
          {host.api.carriers().map((p) => (
            <input key={String(p["value"])} {...normalizeProps(p)} />
          ))}
        </>
      ),
    },
    render,
    undefined,
  )
}

function Input({ render, ref, ...rest }: Own<"input">) {
  const host = useLive("Input")
  const el = useRef<HTMLInputElement | null>(null)
  const range = host.api.completionRange
  // The completed suffix is selected, so the next keystroke replaces it.
  useIsoLayoutEffect(() => {
    const input = el.current
    if (range && input && input.ownerDocument.activeElement === input) {
      input.setSelectionRange(range[0], range[1], "forward")
    }
  }, [range?.[0], range?.[1]])
  return renderPart(
    "input",
    mergeProps({ ...normalizeProps(host.api.input()), ref: composeRefs(el, ref) }, rest),
    render,
    undefined,
  )
}

function Trigger({ render, ...rest }: Own<"button">) {
  const host = useLive("Trigger")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.trigger()), rest),
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

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const host = useLive("Positioner")
  const node = useRef<HTMLElement | null>(null)
  // It holds the popup: it stays while the popup's exit animations run.
  const { mounted } = usePresence(host.open, node, { keepMounted: host.keepMounted, subtree: true })
  const { setPresent } = host
  useIsoLayoutEffect(() => {
    setPresent(mounted)
  }, [mounted, setPresent])
  if (!mounted) return null
  const own = normalizeProps(host.api.positioner())
  const props = mergeProps(
    {
      ...own,
      hidden: own["hidden"] === true || (!host.open && host.keepMounted) || undefined,
      ref: composeRefs(node, ref),
    },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

function Popup({ render, ref, ...rest }: Own<"div">) {
  const host = useLive("Popup")
  const node = useRef<HTMLElement | null>(null)
  const { mounted, state } = usePresence(host.open, node, { keepMounted: host.keepMounted })
  if (!mounted) return null
  const exiting = !host.open && state === "exiting"
  return renderPart(
    "div",
    mergeProps(
      {
        ...normalizeProps(host.api.popup()),
        ...(exiting ? { inert: true } : {}),
        ref: composeRefs(node, ref),
      },
      rest,
    ),
    render,
    undefined,
  )
}

const list = createListboxParts(useComboboxHost)

export const Combobox = {
  Root,
  Label,
  Control,
  Input,
  Trigger,
  ClearTrigger,
  Positioner,
  Popup,
  List: list.List,
  Item: list.Item,
  ItemText: list.ItemText,
  ItemIndicator: list.ItemIndicator,
  Group: list.Section,
  Separator: list.Separator,
  Empty: list.Empty,
  LoadMore: list.LoadMore,
  Items: list.Items,
}
