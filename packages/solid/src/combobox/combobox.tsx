/** @jsxImportSource solid-js */
// Combobox (combobox + combobox-pattern specs): Root derives the listed results from the
// snapshot (patternResults) and passes them as the machine's collection; the list parts are
// the listbox parts under scope "combobox". Wiring only.
import {
  announcerCapability,
  type Chip as ChipData,
  type Collection,
  type CollectionKey,
  type ComboboxActionDetails,
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
  layoutCapability,
  type Modality,
  mergeFieldProps,
  type PositioningProps,
  patternQuery,
  patternResults,
  type ScrollToIndexDetails,
  selectionOf,
  toKey,
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
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import { createPopupParts } from "./popup-parts"

declare const process: { env: { NODE_ENV?: string } }

/** One option of a data-driven combobox. */
export interface ComboboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean | undefined
  readonly section?: { readonly key: string; readonly label: string } | undefined
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
  readonly id?: string | undefined
  /** The combobox parts. */
  readonly children?: JSX.Element
  readonly items?: readonly ComboboxItemData[] | undefined
  /** A collection built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown> | undefined
  readonly inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: ComboboxInputChangeDetails) => void)
    | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ComboboxChangeDetails) => void) | undefined
  readonly allowCustomValue?: boolean | undefined
  /** Multiple: Backspace in the empty input arms, then removes, the last chip. */
  readonly removeOnBackspace?: boolean | undefined
  readonly closeOnSelect?: boolean | undefined
  /** Multiple: clears the text after a choice. Default: true. */
  readonly clearInputOnSelect?: boolean | undefined
  readonly selectOnTab?: boolean | undefined
  /** Opens when the text changes. Default: true. */
  readonly openOnInput?: boolean | undefined
  /** ArrowDown / ArrowUp in the input open the popup. Default: true. */
  readonly openOnArrow?: boolean | undefined
  readonly openOnInputPress?: boolean | undefined
  readonly openOnFocus?: boolean | undefined
  readonly autoHighlight?: boolean | undefined
  /** Keeps a pointer highlight when the pointer leaves the list. Default: false (true inline). */
  readonly keepHighlight?: boolean | undefined
  readonly autoComplete?: "list" | "both" | undefined
  /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter | undefined
  /** The query the given collection answers (async): another query's results are stale. */
  readonly itemsQuery?: string | undefined
  readonly loading?: LoadingStatus | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** The items are virtualized: highlight scrolling goes through `scrollToIndex` and options carry `aria-setsize` / `aria-posinset`. */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted item into view instead of the native `scrollIntoView` (virtualized lists). */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly required?: boolean | undefined
  /** Clearing the text keeps the selection instead of emptying it. */
  readonly disallowEmptySelection?: boolean | undefined
  /** Wraps the highlight at the ends of the list. Default: false. */
  readonly loop?: boolean | undefined
  readonly messages?: Partial<ComboboxMessages> | undefined
  /** Side, align, offset, collisions. */
  readonly positioning?: PositioningProps | undefined
  /** Keep the popup in the DOM (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. Default: 500. */
  readonly typingPause?: number | undefined
  /** The form name of the selected key(s); the visible text is not submitted. */
  readonly name?: string | undefined
  /** Submits the visible text under this name too. */
  readonly inputName?: string | undefined
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string | undefined
  /** Runs an item (inline), or follows a choice (free text). */
  readonly onAction?: ((key: string, details: ComboboxActionDetails) => void) | undefined
  /**
   * The list in place, always shown, items run `onAction` (a command palette). Fixed for the
   * instance's life. Implies `selectionMode="none"`.
   */
  readonly inline?: boolean | undefined
  /** Inline: the current page (`depth` 0: the root page). */
  readonly page?: ComboboxPage | undefined
  /** Inline: Backspace on an empty query above the root page. */
  readonly onBack?: (() => void) | undefined
  /** Free text: Escape on a closed popup clears the text (default false). */
  readonly clearOnEscape?: boolean | undefined
  /** Free text: Enter on a highlighted suggestion fills, then submits the form. */
  readonly submitOnChoose?: boolean | undefined
  /** Free text: the input's native `autocomplete` (default "off"). */
  readonly formAutoComplete?: string | undefined
}

type Selection =
  | {
      /** Free text (an autocomplete): the text is the value, suggestions only fill it. */
      readonly selectionMode: "none"
      readonly multiple?: false | undefined
      readonly value?: never
      readonly defaultValue?: never
      readonly onValueChange?: never
    }
  | {
      readonly selectionMode?: "single" | "multiple" | undefined
      readonly multiple?: false | undefined
      readonly value?: string | null | undefined
      readonly defaultValue?: string | null | undefined
      readonly onValueChange?:
        | ((value: string | null, details: ComboboxChangeDetails) => void)
        | undefined
    }
  | {
      readonly selectionMode?: "single" | "multiple" | undefined
      readonly multiple: true
      readonly value?: readonly string[] | undefined
      readonly defaultValue?: readonly string[] | undefined
      readonly onValueChange?:
        | ((value: readonly string[], details: ComboboxChangeDetails) => void)
        | undefined
    }

export type ComboboxRootProps = Common & Selection

type Api = ReturnType<typeof comboboxConnect>

interface ComboboxHost extends ListboxHost {
  readonly api: Accessor<Api>
  readonly disabled: Accessor<boolean>
  readonly chips: Accessor<readonly ChipData[]>
  readonly keys: Accessor<readonly string[]>
  readonly formInput: FormInputCapability
  readonly constraint: Accessor<HTMLInputElement | null>
  readonly setConstraint: (el: HTMLInputElement | null) => void
  /** A user change happened since the last sync (the hidden input dispatches events). */
  readonly pending: { current: boolean }
  readonly reset: () => void
  readonly autofill: (text: string) => boolean
  readonly keepMounted: Accessor<boolean>
  readonly open: Accessor<boolean>
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: Accessor<boolean>
  readonly inline: boolean
  readonly freeText: Accessor<boolean>
}

const HostContext = createContext<ComboboxHost>()
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
  const p = all as Record<string, unknown> & Common & { selectionMode?: string; multiple?: boolean }
  const base = useEnvironment(announcerCapability, layoutCapability)
  const env = { ...base, position: domPositioning(base) }
  // field-control: the Field's and an enclosing Fieldset's flags, OR-merged with our own.
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "combobox",
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
  const disabled = () => field().disabled
  const instance = useRootId(() => p.id)
  const { collection: registered, registry } = useCollectionItems()
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const full = createMemo(() => p.collection ?? data() ?? registered() ?? EMPTY)
  const multiple = () => p.multiple === true
  // Fixed for the instance's life: the machine definition (states from props, design §1).
  const inline = p.inline === true
  const freeText = () => inline || p.selectionMode === "none"
  if (
    process.env.NODE_ENV !== "production" &&
    inline &&
    (multiple() || p.selectionMode === "single")
  ) {
    console.error('[rind-ui] Combobox: `inline` implies selectionMode "none".')
  }
  const selectionMode = (): "none" | "single" | "multiple" =>
    freeText() ? "none" : multiple() ? "multiple" : "single"
  // One object per page (key, label, depth): a literal `page={{…}}` re-rendered by the parent is
  // no page change (the machine diffs the prop by identity).
  const pageKey = createMemo(() => p.page?.key)
  const pageLabel = createMemo(() => p.page?.label)
  const pageDepth = createMemo(() => p.page?.depth)
  const page = createMemo(() => {
    const key = pageKey()
    return key === undefined
      ? undefined
      : { key, label: pageLabel() ?? "", depth: pageDepth() ?? 0 }
  })
  const ids = createMemo(() => comboboxIds(instance()))
  const locale = () => env.locale.locale()
  const messages = createMemo(() => ({ ...comboboxMessages, ...p.messages }))
  const pending = { current: false }
  // One controller per reported text; the previous one is aborted.
  let fetches: AbortController | null = null
  const nextSignal = () => {
    fetches?.abort()
    fetches = new AbortController()
    return fetches.signal
  }
  const [constraint, setConstraint] = createSignal<HTMLInputElement | null>(null)
  // The selection's text is the initial text (no change callback for it at mount).
  const initialText = untrack(() => {
    if (p.defaultInputValue !== undefined) return p.defaultInputValue
    const v = (p["value"] ?? p["defaultValue"]) as ComboboxValue | undefined
    return typeof v === "string" && !multiple() ? (full().get(toKey(v))?.textValue ?? "") : ""
  })
  // The results answer the snapshot's query: mirrored here, so the props follow it.
  const [query, setQuery] = createSignal("")
  const [openNow, setOpenNow] = createSignal(false)
  const live = createMemo(() => patternResults(full(), query(), p.filter, locale()))
  // While closing, the listed options are those of the moment it started closing.
  let frozen = untrack(live)
  const results = createMemo(() => {
    const l = live()
    if (openNow()) frozen = l
    return openNow() ? l : frozen
  })
  const stale = () => isStale({ itemsQuery: p.itemsQuery, query: query() })
  const { view, service } = useMachine(
    // Sound: both definitions come from one setup (same props, events, context and values).
    (inline ? inlineComboboxMachine : comboboxMachine) as typeof comboboxMachine,
    () => ({
      items: full(),
      collection: results(),
      ids: ids(),
      strategy: "active-descendant" as const,
      selectionMode: selectionMode(),
      disabled: disabled(),
      readOnly: field().readOnly,
      disallowEmptySelection: p.disallowEmptySelection,
      loop: p.loop,
      loading: p.loading,
      onLoadMore: p.onLoadMore,
      virtualized: p.virtualized,
      scrollToIndex: p.scrollToIndex,
      allowCustomValue: p.allowCustomValue,
      removeOnBackspace: p.removeOnBackspace,
      closeOnSelect: p.closeOnSelect,
      clearInputOnSelect: p.clearInputOnSelect,
      selectOnTab: p.selectOnTab,
      openOnInput: p.openOnInput,
      openOnArrow: p.openOnArrow,
      openOnInputPress: p.openOnInputPress,
      openOnFocus: p.openOnFocus,
      autoHighlight: p.autoHighlight ?? (inline ? true : undefined),
      keepHighlight: p.keepHighlight ?? (inline ? true : undefined),
      clearOnEscape: p.clearOnEscape,
      onAction: (k: string, d: ComboboxActionDetails) => p.onAction?.(k, d),
      page: page(),
      onBack: p.onBack ? () => p.onBack?.() : undefined,
      requestClose:
        inline && p.onOpenChange ? () => p.onOpenChange?.(false, { reason: "escape" }) : undefined,
      autoComplete: p.autoComplete,
      locale: locale(),
      messages: messages(),
      root: instance(),
      positioning: p.positioning,
      stale: stale(),
      typingPause: p.typingPause,
      ...("value" in all ? { value: (p["value"] as ComboboxValue | undefined) ?? null } : {}),
      defaultValue: (p["defaultValue"] as ComboboxValue | undefined) ?? (multiple() ? [] : null),
      ...("inputValue" in all ? { inputValue: p.inputValue } : {}),
      defaultInputValue: initialText,
      ...("open" in all ? { open: p.open } : {}),
      defaultOpen: p.defaultOpen,
      onValueChange: (v: ComboboxValue, d: { event: { type: string } }) => {
        pending.current = true
        binding?.().report({ type: "change", value: v, user: true, composing: false })
        const cb = p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined
        cb?.(v, { reason: reasonOf(d.event.type) })
      },
      onInputValueChange: (t: string, d: { event: { type: string } }) => {
        const reason = reasonOf(d.event.type)
        p.onInputValueChange?.(t, { reason, signal: nextSignal() })
        // Free text: a field is a change of its value (field-control "Reporting Changes").
        if (freeText() && !inline) {
          binding?.().report({ type: "change", value: t, user: true, composing: false })
        }
        // Submit on choose: after the filled text is rendered into the input.
        if (freeText() && !inline && reason === "enter" && p.submitOnChoose) {
          env.scheduler.setTimeout(() => {
            const el = env.dom.getById(untrack(ids).input) as HTMLInputElement | null
            el?.form?.requestSubmit()
          }, 0)
        }
      },
      onOpenChange: (o: boolean, d: { event: { type: string } }) => {
        // Closing the popup is a commit (field-control "Reporting Changes").
        if (!o) {
          binding?.().report({ type: "commit" })
          fetches?.abort()
        }
        p.onOpenChange?.(o, { reason: reasonOf(d.event.type) })
      },
    }),
    env,
  )
  const mirror = () => {
    const snap = service.getSnapshot()
    setOpenNow(snap.state === "open")
    setQuery(
      patternQuery({
        inputValue: service.view().values.inputValue ?? "",
        dirty: snap.context.dirty,
        openReason: snap.context.openReason,
      }),
    )
  }
  afterMount(() => {
    mirror()
    onCleanup(service.subscribe(mirror))
  })
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
              // Free text: the visible input is the form control and its own validity element.
              validityElement: () =>
                freeText() ? (env.dom.getById(id) as HTMLInputElement | null) : constraint(),
              value: () =>
                freeText() ? service.view().values.inputValue : service.view().values.value,
            },
            id,
          ),
        ),
      )
    })
  })
  // Free text: a form reset restores the default text (no hidden input carries it).
  afterMount(() => {
    if (!freeText() || inline) return
    const onReset = (e: Event) => {
      const el = env.dom.getById(untrack(ids).input) as HTMLInputElement | null
      if (el && e.target === el.form && !e.defaultPrevented) service.send({ type: "RESET" })
    }
    document.addEventListener("reset", onReset)
    onCleanup(() => document.removeEventListener("reset", onReset))
  })
  const open = () => view().matches("open")
  const [present, setPresent] = createSignal(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = createSignal(false)
  afterMount(() =>
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype),
  )
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
  const modality = useModality(env.modality, () => view().context.focused)
  const value = () => view().values.value as ComboboxValue
  const keys = createMemo(() => {
    const v = value()
    return v == null ? [] : typeof v === "string" ? [v] : v
  })
  const chips = createMemo(() =>
    chipsOf(
      { items: full(), selectionMode: selectionMode(), disabled: disabled(), readOnly: p.readOnly },
      value(),
    ),
  )
  const exposure = () => ({
    open: open(),
    results: results(),
    query: query(),
    itemsQuery: p.itemsQuery,
    loading: p.loading,
  })
  const formInput = hiddenFormInput(
    {
      input: constraint,
      // Sound: the Input part renders an <input> with this id.
      control: () => env.dom.getById(untrack(ids).input) as HTMLElement | null,
    },
    env,
  )
  const api = createMemo(() => {
    const v = view()
    const isOpen = v.matches("open")
    const m = mounted()
    const f = field()
    const val = value()
    return comboboxConnect(
      {
        instance: instance(),
        open: isOpen,
        exposed: isExposed(exposure()),
        empty: isEmptyState(exposure()),
        present: inline || present() || isOpen,
        results: results(),
        context: v.context,
        selection: selectionOf(val),
        selectionMode: selectionMode(),
        inputValue: v.values.inputValue as string,
        hasValue: Array.isArray(val) ? val.length > 0 : val != null,
        disabled: disabled(),
        readOnly: f.readOnly,
        invalid: f.invalid,
        required: f.required,
        field: f,
        fieldData: binding?.().data,
        autoComplete: p.autoComplete ?? "list",
        loading: p.loading,
        modality: modality(),
        dir: env.locale.dir(),
        messages: messages(),
        mounted: {
          label: m.label,
          empty: m.empty,
          description: (key) => m.descriptions.has(key),
        },
        topLayer: topLayer(),
        // Free text: the visible input carries the name (no hidden input).
        name: freeText() ? undefined : f.name,
        inputName: freeText() && !inline ? (p.inputName ?? f.name) : p.inputName,
        inline,
        pageKey: p.page?.key,
        canBack: p.onBack !== undefined && (p.page?.depth ?? 0) > 0,
        escapeCloses: inline && p.onOpenChange !== undefined,
        clearOnEscape: p.clearOnEscape,
        formAutoComplete: p.formAutoComplete,
        form: p.form,
        keys: keys(),
        chips: chips(),
        send: service.send,
      },
      env,
    )
  })
  let loadedFor: Collection<unknown> | null = null
  const host: ComboboxHost = {
    name: "Combobox",
    // Sound: the combobox api has every listbox part the shared parts call.
    parts: createMemo(
      () =>
        ({ ...api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
    ),
    api,
    collection: results,
    registry: p.collection || p.items ? null : registry,
    listed: (key: CollectionKey) => results().has(key),
    mount,
    mountDescription,
    requestLoadMore: () => {
      if ((p.loading ?? "idle") !== "idle" || loadedFor === full()) return
      loadedFor = full()
      p.onLoadMore?.()
    },
    keepMounted: () => p.keepMounted === true,
    disabled,
    chips,
    keys,
    formInput,
    constraint,
    setConstraint,
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
  // Inline: a new query or page starts the list at the top (dip/cmdk#389).
  if (inline) {
    afterMount(() => {
      createEffect(() => {
        view().values.inputValue
        p.page?.key
        // The list's own scroller (the list, or the nearest scrolling ancestor), never the page's.
        let el = env.dom.getById(untrack(ids).list) as HTMLElement | null
        const doc = el?.ownerDocument
        while (el && el !== doc?.body && el !== doc?.documentElement) {
          const overflow = el.ownerDocument.defaultView?.getComputedStyle(el).overflowY ?? ""
          if (/auto|scroll/.test(overflow)) {
            el.scrollTop = 0
            return
          }
          el = el.parentElement
        }
      })
    })
  }
  return <HostContext.Provider value={host}>{p.children}</HostContext.Provider>
}

type Own<A, C = JSX.Element> = Omit<A, "children"> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: C
}

function Label(props: Own<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Label")
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

function Control(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Control")
  // After every change the constraint input mirrors the selection; a user change dispatches.
  afterMount(() => {
    createEffect(() => {
      if (host.freeText()) return
      host.constraint()
      const values = host.keys()
      host.formInput.sync({ values }, { dispatch: host.pending.current })
      host.pending.current = false
    })
    createEffect(() => {
      if (host.freeText()) return
      onCleanup(
        host.formInput.track({
          onReset: host.reset,
          current: () => ({ values: untrack(host.keys) }),
          onNativeInput: (input) => host.autofill(input.value),
        }),
      )
    })
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().control()), rest))
  const carriers = createMemo(() => host.api().carriers())
  const children = () => (
    <>
      {local.children}
      <span {...normalizeProps(host.api().chipsSummaryNode())}>{host.api().chipsSummary}</span>
      {/* Inside the Control: the browser's validation message is anchored near it. */}
      <Show when={!host.freeText()}>
        <input {...normalizeProps(host.api().hiddenInput())} ref={host.setConstraint} />
        <Index each={carriers()}>{(c) => <input {...normalizeProps(c())} />}</Index>
      </Show>
    </>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The part's press, a forwarded label click only focusing it. */
function useLabelAwarePress(onPress: (modality: Modality) => void, disabled: Accessor<boolean>) {
  const env = useEnvironment()
  return usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
    labelActivation: "focus",
  })
}

function Input(props: Own<JSX.InputHTMLAttributes<HTMLInputElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Input")
  const press = useLabelAwarePress((m) => untrack(host.api).pressInput(m), host.disabled)
  const [el, setEl] = createSignal<HTMLInputElement | null>(null)
  const range = createMemo(() => host.api().completionRange?.join(","))
  // The completed suffix is selected, so the next keystroke replaces it.
  afterMount(() => {
    createEffect(() => {
      range()
      const r = host.api().completionRange
      const input = el()
      if (r && input && input.ownerDocument.activeElement === input) {
        input.setSelectionRange(r[0], r[1], "forward")
      }
    })
  })
  const merged = createMemo(() => {
    const own = normalizeProps(host.api().input())
    // Like React's controlled input, the `value` attribute follows the text (what a form reset
    // restores, and what the markup shows, also when empty).
    if (typeof own["value"] === "string") own["attr:value"] = own["value"]
    return mergeProps({ ...joinHandlers(own, press.props), ref: setEl }, rest)
  })
  return renderPart(
    local.render,
    merged,
    undefined,
    () => undefined,
    (p) => <input {...p} />,
  )
}

function Trigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Trigger")
  if (host.inline && process.env.NODE_ENV !== "production") {
    afterMount(() => console.warn("[rind-ui] Combobox: an inline combobox renders no Trigger."))
  }
  const press = useLabelAwarePress((m) => untrack(host.api).pressTrigger(m), host.disabled)
  const merged = createMemo(() =>
    mergeProps(joinHandlers(normalizeProps(host.api().trigger()), press.props), rest),
  )
  const children = () => local.children
  if (host.inline) return null
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function ClearTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("ClearTrigger")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().clearTrigger()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Loading content: a sibling of the List, shown while loading, with no live role. */
function Loading(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Loading")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().loading()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const popup = createPopupParts((part) => {
  const host = useComboboxHost(part)
  return host
})
const { Positioner, Popup } = popup

const ChipCtx = createContext<string>()
const useChipKey = (part: string) => {
  const key = useContext(ChipCtx)
  if (key === undefined) throw new Error(`Combobox.${part} must be inside Combobox.Chips`)
  return key
}

function Chip(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Chip")
  const key = useChipKey("Chip")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chip(key)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function ChipRemove(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("ChipRemove")
  const key = useChipKey("ChipRemove")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chipRemove(key)), rest))
  const children = () => local.children ?? <span aria-hidden="true">×</span>
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The chips toolbar (multiple): one Chip per selected option, before the Input. */
function Chips(props: Own<JSX.HTMLAttributes<HTMLDivElement>, (chip: ChipData) => JSX.Element>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useComboboxHost("Chips")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().chips()), rest))
  // One scope per key: a change of the selection keeps the other chips mounted.
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
          <ChipCtx.Provider value={key}>
            {local.children ? (
              local.children(chip)
            ) : (
              <Chip>
                {chip.text}
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

const list = createListboxParts(useComboboxHost)
const {
  List,
  Item,
  ItemText,
  ItemDescription,
  ItemIndicator,
  Section: Group,
  Separator,
  Empty,
  LoadMore,
  Items,
} = list

/** The parts, by name: `combobox.parts.ts` re-exports them as the `Combobox` namespace. */
export {
  Chip,
  ChipRemove,
  Chips,
  ClearTrigger,
  Control,
  Empty,
  Group,
  Input,
  Item,
  ItemDescription,
  ItemIndicator,
  Items,
  ItemText,
  Label,
  List,
  Loading,
  LoadMore,
  Popup,
  Positioner,
  Root,
  Separator,
  Trigger,
}
