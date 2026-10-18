// Combobox (combobox + combobox-pattern specs): Root derives the listed results from the
// snapshot (patternResults) and passes them as the machine's collection; the list parts are
// the listbox parts under scope "combobox". Wiring only.

import {
  type Chip as ChipData,
  type Collection,
  type CollectionKey,
  type ComboboxActionDetails,
  type ComboboxApi,
  type ComboboxFilter,
  type ComboboxMessages,
  type ComboboxPage,
  type ComboboxValue,
  chipsOf,
  comboboxConnect,
  comboboxIds,
  comboboxMachine,
  comboboxMessages,
  createListCollection,
  domPositioning,
  type FormInputCapability,
  focusSafely,
  hiddenFormInput,
  inlineComboboxMachine,
  isEmptyState,
  isExposed,
  isStale,
  type LoadingStatus,
  type Modality,
  mergeFieldProps,
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
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
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
import { usePress } from "../use-press"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

declare const process: { env: { NODE_ENV?: string } }

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

export interface ComboboxInputChangeDetails extends ComboboxChangeDetails {
  /** Aborted when a newer text change is reported or the popup closes (async fetches). */
  readonly signal: AbortSignal
}

interface Common {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string
  /** The combobox parts. */
  readonly children?: ReactNode
  readonly items?: readonly ComboboxItemData[]
  /** A collection built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown>
  readonly inputValue?: string
  readonly defaultInputValue?: string
  readonly onInputValueChange?: (text: string, details: ComboboxInputChangeDetails) => void
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: ComboboxChangeDetails) => void
  readonly allowCustomValue?: boolean
  /** Multiple: Backspace in the empty input arms, then removes, the last chip. */
  readonly removeOnBackspace?: boolean
  readonly closeOnSelect?: boolean
  /** Multiple: clears the text after a choice. Default: true. */
  readonly clearInputOnSelect?: boolean
  readonly selectOnTab?: boolean
  /** Opens when the text changes. Default: true. */
  readonly openOnInput?: boolean
  /** ArrowDown / ArrowUp in the input open the popup. Default: true. */
  readonly openOnArrow?: boolean
  readonly openOnInputPress?: boolean
  readonly openOnFocus?: boolean
  readonly autoHighlight?: boolean
  /** Keeps a pointer highlight when the pointer leaves the list. Default: false (true inline). */
  readonly keepHighlight?: boolean
  readonly autoComplete?: "list" | "both"
  /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter
  /** The query the given collection answers (async): another query's results are stale. */
  readonly itemsQuery?: string
  readonly loading?: LoadingStatus
  readonly onLoadMore?: () => void
  /** The items are virtualized: highlight scrolling goes through `scrollToIndex` and options carry `aria-setsize` / `aria-posinset`. */
  readonly virtualized?: boolean
  /** Scrolls the highlighted item into view instead of the native `scrollIntoView` (virtualized lists). */
  readonly scrollToIndex?: (details: ScrollToIndexDetails) => void
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly required?: boolean
  /** Clearing the text keeps the selection instead of emptying it. */
  readonly disallowEmptySelection?: boolean
  /** Wraps the highlight at the ends of the list. Default: false. */
  readonly loop?: boolean
  readonly messages?: Partial<ComboboxMessages>
  /** Side, align, offset, collisions. */
  readonly positioning?: PositioningProps
  /** Keep the popup in the DOM (hidden) while closed. */
  readonly keepMounted?: boolean
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. Default: 500. */
  readonly typingPause?: number
  /** The form name of the selected key(s); the visible text is not submitted. */
  readonly name?: string
  /** Submits the visible text under this name too. */
  readonly inputName?: string
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string
  /** Runs an item (inline), or follows a choice (free text). */
  readonly onAction?: (key: string, details: ComboboxActionDetails) => void
  /**
   * The list in place, always shown, items run `onAction` (a command palette). Fixed for the
   * instance's life. Implies `selectionMode="none"`.
   */
  readonly inline?: boolean
  /** Inline: the current page (`depth` 0: the root page). */
  readonly page?: ComboboxPage
  /** Inline: Backspace on an empty query above the root page. */
  readonly onBack?: () => void
  /** Free text: Escape on a closed popup clears the text (default false). */
  readonly clearOnEscape?: boolean
  /** Free text: Enter on a highlighted suggestion fills, then submits the form. */
  readonly submitOnChoose?: boolean
  /** Free text: the input's native `autocomplete` (default "off"). */
  readonly formAutoComplete?: string
}

type Selection =
  | {
      /** Free text (an autocomplete): the text is the value, suggestions only fill it. */
      readonly selectionMode: "none"
      readonly multiple?: false
      readonly value?: never
      readonly defaultValue?: never
      readonly onValueChange?: never
    }
  | {
      readonly selectionMode?: "single" | "multiple"
      readonly multiple?: false
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: ComboboxChangeDetails) => void
    }
  | {
      readonly selectionMode?: "single" | "multiple"
      readonly multiple: true
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: ComboboxChangeDetails) => void
    }

export type ComboboxRootProps = Common & Selection

interface ComboboxHost extends ListboxHost {
  readonly api: ComboboxApi
  readonly disabled: boolean
  readonly chips: readonly ChipData[]
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
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: boolean
  readonly inline: boolean
  readonly freeText: boolean
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
    "CHIP.REMOVE": "chip-remove",
    BACKSPACE_EMPTY: "chip-remove",
    "CHIP.TYPE": "input-change",
    AUTOFILL: "autofill",
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
  const { id, items, collection: given, children } = all
  const p = all as Record<string, unknown>
  const base = useEnvironment()
  const env = useMemo(() => ({ ...base, position: domPositioning(base) }), [base])
  // field-control: the Field's and an enclosing Fieldset's flags, OR-merged with our own.
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = mergeFieldProps(
    {
      role: "combobox",
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
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const full = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(full, "Combobox")
  const multiple = all.multiple === true
  // Fixed for the instance's life: the machine definition (states from props, design §1).
  const [inline] = useState(() => all.inline === true)
  if (process.env.NODE_ENV !== "production" && inline !== (all.inline === true)) {
    console.warn("[rind-ui] Combobox: `inline` cannot change after mount; remount instead.")
  }
  const freeText = inline || all.selectionMode === "none"
  if (
    process.env.NODE_ENV !== "production" &&
    inline &&
    (multiple || all.selectionMode === "single")
  ) {
    console.error('[rind-ui] Combobox: `inline` implies selectionMode "none".')
  }
  const selectionMode = freeText ? "none" : multiple ? "multiple" : "single"
  // One object per page (key, label, depth): a literal `page={{…}}` re-rendered by the parent is
  // no page change (the machine diffs the prop by identity).
  const pageKey = all.page?.key
  const pageLabel = all.page?.label
  const pageDepth = all.page?.depth
  const page = useMemo(
    () =>
      pageKey === undefined
        ? undefined
        : { key: pageKey, label: pageLabel ?? "", depth: pageDepth ?? 0 },
    [pageKey, pageLabel, pageDepth],
  )
  const ids = useMemo(() => comboboxIds(instance), [instance])
  const locale = env.locale.locale()
  const messages = useMemo(() => ({ ...comboboxMessages, ...all.messages }), [all.messages])
  const latest = useRef(all)
  latest.current = all
  const pending = useRef(false)
  // One controller per reported text; the previous one is aborted.
  const fetches = useRef<AbortController | null>(null)
  const nextSignal = () => {
    fetches.current?.abort()
    fetches.current = new AbortController()
    return fetches.current.signal
  }
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
    // Sound: both definitions come from one setup (same props, events, context and values).
    (inline ? inlineComboboxMachine : comboboxMachine) as typeof comboboxMachine,
    {
      items: full,
      collection: results,
      ids,
      strategy: "active-descendant",
      selectionMode,
      disabled,
      readOnly,
      disallowEmptySelection: all.disallowEmptySelection,
      loop: all.loop,
      loading: all.loading,
      onLoadMore: all.onLoadMore,
      virtualized: all.virtualized,
      scrollToIndex: all.scrollToIndex,
      allowCustomValue: all.allowCustomValue,
      removeOnBackspace: all.removeOnBackspace,
      closeOnSelect: all.closeOnSelect,
      clearInputOnSelect: all.clearInputOnSelect,
      selectOnTab: all.selectOnTab,
      openOnInput: all.openOnInput,
      openOnArrow: all.openOnArrow,
      openOnInputPress: all.openOnInputPress,
      openOnFocus: all.openOnFocus,
      autoHighlight: all.autoHighlight ?? (inline ? true : undefined),
      keepHighlight: all.keepHighlight ?? (inline ? true : undefined),
      clearOnEscape: all.clearOnEscape,
      onAction: (k, d) => latest.current.onAction?.(k, d),
      page,
      onBack: all.onBack ? () => latest.current.onBack?.() : undefined,
      requestClose:
        inline && all.onOpenChange
          ? () => latest.current.onOpenChange?.(false, { reason: "escape" })
          : undefined,
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
        binding?.report({ type: "change", value: v, user: true, composing: false })
        const cb = latest.current.onValueChange as ((v: unknown, d: unknown) => void) | undefined
        cb?.(v, { reason: reasonOf(d.event.type) })
      },
      onInputValueChange: (t, d) => {
        const reason = reasonOf(d.event.type)
        latest.current.onInputValueChange?.(t, { reason, signal: nextSignal() })
        // Free text: a field is a change of its value (field-control "Reporting Changes").
        if (freeText && !inline) {
          binding?.report({ type: "change", value: t, user: true, composing: false })
        }
        // Submit on choose: after the filled text is rendered into the input.
        if (freeText && !inline && reason === "enter" && latest.current.submitOnChoose) {
          env.scheduler.setTimeout(() => {
            const el = env.dom.getById(ids.input) as HTMLInputElement | null
            el?.form?.requestSubmit()
          }, 0)
        }
      },
      onOpenChange: (o, d) => {
        // Closing the popup is a commit (field-control "Reporting Changes").
        if (!o) {
          binding?.report({ type: "commit" })
          fetches.current?.abort()
        }
        latest.current.onOpenChange?.(o, { reason: reasonOf(d.event.type) })
      },
    },
    env,
  )
  svc.current = service
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
        // Free text: the visible input is the form control and its own validity element.
        validityElement: () =>
          freeText ? (env.dom.getById(ids.input) as HTMLInputElement | null) : constraint.current,
        value: () => (freeText ? service.view().values.inputValue : service.view().values.value),
      },
      ids.input,
    )
  }, [register, ids.input, env, service, freeText])
  // Free text: a form reset restores the default text (no hidden input carries it).
  useEffect(() => {
    if (!freeText || inline || typeof document === "undefined") return
    const onReset = (e: Event) => {
      const el = env.dom.getById(ids.input) as HTMLInputElement | null
      if (el && e.target === el.form && !e.defaultPrevented) service.send({ type: "RESET" })
    }
    document.addEventListener("reset", onReset)
    return () => document.removeEventListener("reset", onReset)
  }, [freeText, inline, env, ids.input, service])
  const view = service.view()
  const open = view.matches("open")
  const [present, setPresent] = useState(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = useState(false)
  useEffect(() => {
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype)
  }, [])
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
  const chips = chipsOf({ items: full, selectionMode, disabled, readOnly: all.readOnly }, value)
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
      present: inline || present || open,
      results,
      context: view.context,
      selection: selectionOf(value),
      selectionMode,
      inputValue: view.values.inputValue as string,
      hasValue: Array.isArray(value) ? value.length > 0 : value != null,
      disabled,
      readOnly: readOnly,
      invalid: field.invalid,
      required: field.required,
      field,
      fieldData: binding?.data,
      autoComplete: all.autoComplete ?? "list",
      loading: all.loading,
      modality,
      dir: env.locale.dir(),
      messages,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      topLayer,
      // Free text: the visible input carries the name (no hidden input).
      name: freeText ? undefined : field.name,
      inputName: freeText && !inline ? (all.inputName ?? field.name) : all.inputName,
      inline,
      pageKey: all.page?.key,
      canBack: all.onBack !== undefined && (all.page?.depth ?? 0) > 0,
      escapeCloses: inline && all.onOpenChange !== undefined,
      clearOnEscape: all.clearOnEscape,
      formAutoComplete: all.formAutoComplete,
      form: all.form,
      keys,
      chips,
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
    mountDescription,
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
    disabled,
    chips,
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
    topLayer,
    inline,
    freeText,
  }
  // Inline: a new query or page starts the list at the top (dip/cmdk#389), in the same update.
  const inputNow = view.values.inputValue as string
  useIsoLayoutEffect(() => {
    if (!inline) return
    // The list's own scroller (the list, or the nearest scrolling ancestor), never the page's.
    let el = env.dom.getById(ids.list) as HTMLElement | null
    const doc = el?.ownerDocument
    while (el && el !== doc?.body && el !== doc?.documentElement) {
      const overflow = el.ownerDocument.defaultView?.getComputedStyle(el).overflowY ?? ""
      if (/auto|scroll/.test(overflow)) {
        el.scrollTop = 0
        return
      }
      el = el.parentElement
    }
  }, [inline, inputNow, all.page?.key])
  return <HostContext value={host}>{children}</HostContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
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
  const { formInput, pending, keys, reset, autofill, freeText } = host
  const latest = useRef(keys)
  latest.current = keys
  // After every commit the constraint input mirrors the selection; a user change dispatches.
  useIsoLayoutEffect(() => {
    if (freeText) return
    formInput.sync({ values: keys }, { dispatch: pending.current })
    pending.current = false
  })
  useEffect(
    () =>
      freeText
        ? undefined
        : formInput.track({
            onReset: reset,
            current: () => ({ values: latest.current }),
            onNativeInput: (input) => autofill(input.value),
          }),
    [formInput, reset, autofill, freeText],
  )
  const props = mergeProps(normalizeProps(host.api.control()), rest)
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <>
          {children}
          <span {...normalizeProps(host.api.chipsSummaryNode())}>{host.api.chipsSummary}</span>
          {/* Inside the Control: the browser's validation message is anchored near it. */}
          {freeText ? null : (
            <>
              <input {...normalizeProps(host.api.hiddenInput())} ref={host.constraint} />
              {host.api.carriers().map((p) => (
                <input key={String(p["value"])} {...normalizeProps(p)} />
              ))}
            </>
          )}
        </>
      ),
    },
    render,
    undefined,
  )
}

/** The part's press, a forwarded label click only focusing it. */
function useLabelAwarePress(onPress: (modality: Modality) => void, disabled: boolean) {
  const env = useEnvironment()
  return usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled: () => disabled,
    labelActivation: "focus",
  })
}

function Input({ render, ref, ...rest }: Own<"input">) {
  const host = useLive("Input")
  const press = useLabelAwarePress(host.api.pressInput, host.disabled)
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
    mergeProps(
      { ...joinHandlers(normalizeProps(host.api.input()), press.props), ref: composeRefs(el, ref) },
      rest,
    ),
    render,
    undefined,
  )
}

/** Inline: popup parts render nothing (combobox "Anatomy"). */
function useInlineWarning(host: ComboboxHost, part: string) {
  useEffect(() => {
    if (host.inline && process.env.NODE_ENV !== "production") {
      console.warn(`[rind-ui] Combobox: an inline combobox renders no ${part}.`)
    }
  }, [host.inline, part])
}

function Trigger({ render, ...rest }: Own<"button">) {
  const host = useLive("Trigger")
  useInlineWarning(host, "Trigger")
  const press = useLabelAwarePress(host.api.pressTrigger, host.disabled)
  if (host.inline) return null
  return renderPart(
    "button",
    mergeProps(joinHandlers(normalizeProps(host.api.trigger()), press.props), rest),
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
  useInlineWarning(host, "Positioner")
  const node = useRef<HTMLElement | null>(null)
  // It holds the popup: it stays while the popup's exit animations run.
  const { mounted } = usePresence(host.open, node, { keepMounted: host.keepMounted, subtree: true })
  const { setPresent, topLayer } = host
  useIsoLayoutEffect(() => {
    setPresent(mounted)
  }, [mounted, setPresent])
  // Into the top layer while mounted (`popover="manual"`): above every stacking context of
  // the page, with no portal. Engines without the Popover API keep it in place.
  useIsoLayoutEffect(() => {
    const el = node.current as (HTMLElement & { showPopover?: () => void }) | null
    if (!mounted || !topLayer || !el || typeof el.showPopover !== "function") return
    try {
      if (!el.matches(":popover-open")) el.showPopover()
    } catch {
      // Already shown, or not connected yet: the next commit retries.
    }
    return () => {
      try {
        if (el.matches(":popover-open")) el.hidePopover()
      } catch {
        // Removed with its subtree.
      }
    }
  }, [mounted, topLayer])
  if (!mounted || host.inline) return null
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
  useInlineWarning(host, "Popup")
  const node = useRef<HTMLElement | null>(null)
  const { mounted, state } = usePresence(host.open, node, { keepMounted: host.keepMounted })
  if (!mounted || host.inline) return null
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

const ChipCtx = createContext<string | null>(null)

/** The chips toolbar (multiple): one Chip per selected option, before the Input. */
function Chips({
  render,
  children,
  ...rest
}: Omit<Own<"div">, "children"> & {
  /** Renders one chip; default: its text and a remove button. */
  readonly children?: (chip: ChipData) => ReactNode
}) {
  const host = useLive("Chips")
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(host.api.chips()), rest),
      children: host.chips.map((chip) => (
        <ChipCtx key={chip.key} value={chip.key}>
          {children ? (
            children(chip)
          ) : (
            <Chip>
              {chip.text}
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

const useChipKey = (part: string) => {
  const key = useContext(ChipCtx)
  if (key === null) throw new Error(`Combobox.${part} must be inside Combobox.Chips`)
  return key
}

function Chip({ render, ...rest }: Own<"span">) {
  const host = useLive("Chip")
  const key = useChipKey("Chip")
  return renderPart("span", mergeProps(normalizeProps(host.api.chip(key)), rest), render, undefined)
}

function ChipRemove({ render, children, ...rest }: Own<"button">) {
  const host = useLive("ChipRemove")
  const key = useChipKey("ChipRemove")
  return renderPart(
    "button",
    mergeProps(normalizeProps(host.api.chipRemove(key)), {
      ...rest,
      children: children ?? <span aria-hidden="true">×</span>,
    }),
    render,
    undefined,
  )
}

const list = createListboxParts(useComboboxHost)

/** Loading content: a sibling of the List, shown while loading, with no live role. */
function Loading({ render, ...rest }: Own<"div">) {
  const host = useLive("Loading")
  return renderPart("div", mergeProps(normalizeProps(host.api.loading()), rest), render, undefined)
}

export const Combobox = {
  Root,
  Label,
  Control,
  Input,
  Chips,
  Chip,
  ChipRemove,
  Trigger,
  ClearTrigger,
  Positioner,
  Popup,
  List: list.List,
  Item: list.Item,
  ItemText: list.ItemText,
  ItemDescription: list.ItemDescription,
  ItemIndicator: list.ItemIndicator,
  Group: list.Section,
  Separator: list.Separator,
  Empty: list.Empty,
  LoadMore: list.LoadMore,
  Loading,
  Items: list.Items,
}
