// Combobox (combobox + combobox-pattern specs): Root derives the listed results from the
// snapshot (patternResults) and passes them as the machine's collection; the list parts are
// the listbox parts under scope "combobox". Wiring only.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  Injector,
  inject,
  input,
  isDevMode,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
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
  type PartProps,
  type PositioningProps,
  patternQuery,
  patternResults,
  type ScrollToIndexDetails,
  selectionOf,
  toKey,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems } from "../collection-items"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality, injectPress } from "../inject-press"
import { injectRendered } from "../layer-context"
import {
  groupsOf,
  LISTBOX_HOST,
  ListboxEmpty,
  type ListboxGroup,
  type ListboxHost,
  ListboxItem,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
  ListboxList,
  ListboxLoadMore,
  ListboxSection,
  ListboxSeparator,
} from "../listbox/parts"
import { injectEnvironment, withCapabilities } from "../provider"
import { RindProps } from "../rind-props"

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

type Value = string | null | readonly string[]

/** What a `valueChangeDetails` output emits. */
export interface ComboboxValueEvent {
  readonly value: Value
  readonly details: ComboboxChangeDetails
}

/** What an `inputValueChangeDetails` output emits. */
export interface ComboboxInputValueEvent {
  readonly value: string
  readonly details: ComboboxInputChangeDetails
}

/** What an `action` output emits. */
export interface ComboboxActionEvent {
  readonly key: string
  readonly details: ComboboxActionDetails
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

const COMBOBOX = new InjectionToken<ComboboxRoot>("rind-ui.combobox")

/** What the popup parts (Positioner, Popup) read from their host: Combobox, Tags Input. */
export interface PopupHost {
  readonly api: () => { positioner(): PartProps; popup(): PartProps }
  readonly isOpen: () => boolean
  readonly keepMounted: () => boolean
  readonly present: { set(present: boolean): void }
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: () => boolean
  /** A list in place: the popup parts render nothing. */
  readonly inlineMode: boolean
  readonly list: { instance(): string }
  /** The host's name in warnings (`Combobox`) and its parts' scope (`combobox`). */
  readonly popupName: string
  readonly popupScope: string
}

/** The host of the popup parts. Internal. */
export const POPUP_HOST = new InjectionToken<PopupHost>("rind-ui.popup-host")

function injectPopupHost(part: string): PopupHost {
  const host = inject(POPUP_HOST, { optional: true })
  if (!host)
    throw new Error(`The popup's ${part} must be inside rindComboboxRoot or rindTagsInputRoot`)
  return host
}

function injectHost(part: string): ComboboxRoot {
  const host = inject(COMBOBOX, { optional: true })
  if (!host) throw new Error(`rindCombobox${part} must be inside rindComboboxRoot`)
  return host
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

type Api = ReturnType<typeof comboboxConnect>

/**
 * A text input with a list of options: `<ng-container rindComboboxRoot>` (no element of its
 * own) with a Label, a Control (Chips, Input, Trigger) and a Positioner holding the Popup and
 * its List; `inline`: the list in place (a command palette).
 */
@Directive({
  selector: "[rindComboboxRoot]",
  exportAs: "rindComboboxRoot",
  providers: [
    { provide: COMBOBOX, useExisting: forwardRef(() => ComboboxRoot) },
    { provide: POPUP_HOST, useExisting: forwardRef(() => ComboboxRoot) },
    { provide: LISTBOX_HOST, useFactory: () => inject(forwardRef(() => ComboboxRoot)).list },
  ],
})
export class ComboboxRoot implements PopupHost {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id = input<string>()
  readonly items = input<readonly ComboboxItemData[]>()
  /** A collection built by the consumer (virtualized or async lists). */
  readonly collection = input<Collection<unknown>>()
  /** Free text (`"none"`: an autocomplete, the text is the value). Read at creation. */
  readonly selectionMode = input<"none" | "single" | "multiple">()
  /** Several values. Read at creation. */
  readonly multiple = input(false, { transform: booleanAttribute })
  /** The value (`[(value)]`): a key or null; with `multiple`, the keys. */
  readonly value = input<Value>()
  readonly defaultValue = input<Value>()
  /** The text (`[(inputValue)]`). */
  readonly inputValue = input<string>()
  readonly defaultInputValue = input<string>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly allowCustomValue = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Multiple: Backspace in the empty input arms, then removes, the last chip. */
  readonly removeOnBackspace = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly closeOnSelect = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Multiple: clears the text after a choice. Default: true. */
  readonly clearInputOnSelect = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly selectOnTab = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Opens when the text changes. Default: true. */
  readonly openOnInput = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** ArrowDown / ArrowUp in the input open the popup. Default: true. */
  readonly openOnArrow = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly openOnInputPress = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly openOnFocus = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly autoHighlight = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Keeps a pointer highlight when the pointer leaves the list. Default: false (true inline). */
  readonly keepHighlight = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly autoComplete = input<"list" | "both">()
  /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
  readonly filter = input<ComboboxFilter>()
  /** The query the given collection answers (async): another query's results are stale. */
  readonly itemsQuery = input<string>()
  readonly loading = input<LoadingStatus>()
  /** The items are virtualized: highlight scrolling goes through `scrollToIndex`. */
  readonly virtualized = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Scrolls the highlighted item into view instead of the native `scrollIntoView`. */
  readonly scrollToIndex = input<(details: ScrollToIndexDetails) => void>()
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly readOnly = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly invalid = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly required = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Clearing the text keeps the selection instead of emptying it. */
  readonly disallowEmptySelection = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  /** Wraps the highlight at the ends of the list. Default: false. */
  readonly loop = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly messages = input<Partial<ComboboxMessages>>()
  /** Side, align, offset, collisions. */
  readonly positioning = input<PositioningProps>()
  /** Keep the popup in the DOM (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
  readonly typingPause = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** The form name of the selected key(s); the visible text is not submitted. */
  readonly name = input<string>()
  /** Submits the visible text under this name too. */
  readonly inputName = input<string>()
  /** The id of the form the hidden inputs belong to. */
  readonly form = input<string>()
  /** The list in place, always shown, items emit `action` (a command palette). Read at creation. */
  readonly inline = input(false, { transform: booleanAttribute })
  /** Inline: the current page (`depth` 0: the root page). */
  readonly page = input<ComboboxPage>()
  /** Free text: Escape on a closed popup clears the text (default false). */
  readonly clearOnEscape = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Free text: Enter on a highlighted suggestion fills, then submits the form. */
  readonly submitOnChoose = input(false, { transform: booleanAttribute })
  /** Free text: the input's native `autocomplete` (default "off"). */
  readonly formAutoComplete = input<string>()
  /** Inline: Backspace on an empty query above the root page (when set). */
  readonly onBack = input<() => void>()
  /** Inline: Escape asks to close (when set). */
  readonly requestClose = input<() => void>()
  readonly onLoadMore = input<() => void>()
  readonly valueChangeDetails = output<ComboboxValueEvent>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<Value>()
  readonly inputValueChangeDetails = output<ComboboxInputValueEvent>()
  /** The text, for `[(inputValue)]`. */
  readonly inputValueChange = output<string>()
  /** The visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()
  /** Runs an item (inline), or follows a choice (free text). */
  readonly action = output<ComboboxActionEvent>()

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly isOpen: () => boolean
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly chipList: Signal<readonly ChipData[]>
  /** @internal */
  readonly keys: Signal<readonly string[]>
  /** @internal */
  readonly formInput: ReturnType<typeof hiddenFormInput>
  /** @internal */
  constraint: HTMLInputElement | null = null
  /** @internal A user change happened since the last sync (the hidden input dispatches events). */
  pending = false
  /** @internal */
  readonly present = signal(false)
  /** @internal The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer = signal(false)
  /** @internal Fixed for the instance's life. */
  inlineMode = false
  /** @internal */
  readonly popupName = "Combobox"
  /** @internal */
  readonly popupScope = "combobox"
  /** @internal Fixed for the instance's life. */
  freeText = false
  /** @internal */
  readonly list: ListboxHost
  /** @internal */
  readonly reset: () => void
  /** @internal */
  readonly autofill: (text: string) => boolean
  /** The listed options' sections and items in render order, for an `@for` (data items). */
  readonly groups: Signal<readonly ListboxGroup[]>
  /** The chips (multiple), for an `@for` of Chips. */
  readonly chips: Signal<readonly ChipData[]>

  constructor() {
    const base = injectEnvironment(announcerCapability, layoutCapability)
    const env = withCapabilities(base, { position: domPositioning(base) })
    // field-control: the Field's and an enclosing Fieldset's flags, OR-merged with our own.
    const binding = injectFieldControl()
    const fieldsetDisabled = injectFieldsetDisabled()
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "combobox",
          labelable: true,
          disabled: this.disabled() === true || fieldsetDisabled(),
          readOnly: this.readOnly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
        },
        binding?.() ?? null,
      ),
    )
    const disabled = () => field().disabled
    this.disabledState = disabled
    const instance = injectRootId(() => this.id())
    const { collection: registered, registry } = injectCollectionItems()
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const full = () => this.collection() ?? data() ?? registered() ?? EMPTY
    // Fixed for the instance's life: the machine definition (states from props, design §1).
    // Read at the machine's creation, once the inputs are set (the first props read).
    const mode = (): "none" | "single" | "multiple" =>
      this.freeText ? "none" : untracked(this.multiple) ? "multiple" : "single"
    let decided = false
    const decide = () => {
      if (decided) return
      decided = true
      this.inlineMode = untracked(this.inline)
      this.freeText = this.inlineMode || untracked(this.selectionMode) === "none"
      if (
        isDevMode() &&
        this.inlineMode &&
        (untracked(this.multiple) || untracked(this.selectionMode) === "single")
      ) {
        console.error('[rind-ui] Combobox: `inline` implies selectionMode "none".')
      }
    }
    // One object per page: a parent re-rendering a literal `page` is no page change.
    const pageKey = computed(() => {
      const p = this.page()
      return p?.key === undefined ? "" : `${p.key}\u0000${p.label ?? ""}\u0000${p.depth ?? 0}`
    })
    const page = computed(() => {
      pageKey()
      const p = untracked(this.page)
      return p?.key === undefined
        ? undefined
        : { key: p.key, label: p.label ?? "", depth: p.depth ?? 0 }
    })
    let ids: ReturnType<typeof comboboxIds> | undefined
    const idsNow = () => {
      ids ??= comboboxIds(instance())
      return ids
    }
    const locale = () => env.locale.locale()
    const messages = computed(() => ({ ...comboboxMessages, ...this.messages() }))
    // One controller per reported text; the previous one is aborted.
    let fetches: AbortController | null = null
    const nextSignal = () => {
      fetches?.abort()
      fetches = new AbortController()
      return fetches.signal
    }
    // The results answer the snapshot's query: mirrored here, so the props follow it.
    const query = signal("")
    const openNow = signal(false)
    const live = computed(() => patternResults(full(), query(), this.filter(), locale()))
    // While closing, the listed options are those of the moment it started closing.
    let frozen: ReturnType<typeof patternResults> | undefined
    const results = computed(() => {
      const l = live()
      if (openNow() || frozen === undefined) frozen = l
      return openNow() ? l : frozen
    })
    const stale = () => isStale({ itemsQuery: this.itemsQuery(), query: query() })
    let initialText: string | undefined
    const machine = injectMachine(
      // Picked when the service is created, after the inputs (`inline` is fixed from then on).
      // Sound: both definitions come from one setup (same props, events, context and values).
      () => {
        decide()
        return this.inlineMode ? (inlineComboboxMachine as typeof comboboxMachine) : comboboxMachine
      },
      () => {
        decide()
        const inline = this.inlineMode
        const multiple = this.multiple()
        const value = this.value()
        const inputValue = this.inputValue()
        const open = this.open()
        // The selection's text is the initial text (no change callback for it at creation).
        initialText ??= (() => {
          const d = untracked(this.defaultInputValue)
          if (d !== undefined) return d
          const v = untracked(this.value) ?? untracked(this.defaultValue)
          return typeof v === "string" && !multiple
            ? (untracked(full).get(toKey(v))?.textValue ?? "")
            : ""
        })()
        const onBack = this.onBack()
        const requestClose = this.requestClose()
        return {
          items: full(),
          collection: results(),
          ids: idsNow(),
          strategy: "active-descendant" as const,
          selectionMode: mode(),
          disabled: disabled(),
          readOnly: field().readOnly,
          disallowEmptySelection: this.disallowEmptySelection(),
          loop: this.loop(),
          loading: this.loading(),
          onLoadMore: this.onLoadMore(),
          virtualized: this.virtualized(),
          scrollToIndex: this.scrollToIndex(),
          allowCustomValue: this.allowCustomValue(),
          removeOnBackspace: this.removeOnBackspace(),
          closeOnSelect: this.closeOnSelect(),
          clearInputOnSelect: this.clearInputOnSelect(),
          selectOnTab: this.selectOnTab(),
          openOnInput: this.openOnInput(),
          openOnArrow: this.openOnArrow(),
          openOnInputPress: this.openOnInputPress(),
          openOnFocus: this.openOnFocus(),
          autoHighlight: this.autoHighlight() ?? (inline ? true : undefined),
          keepHighlight: this.keepHighlight() ?? (inline ? true : undefined),
          clearOnEscape: this.clearOnEscape(),
          onAction: (k: string, d: ComboboxActionDetails) =>
            this.action.emit({ key: k, details: d }),
          page: page(),
          onBack: onBack ? () => onBack() : undefined,
          requestClose: inline && requestClose ? () => requestClose() : undefined,
          autoComplete: this.autoComplete(),
          locale: locale(),
          messages: messages(),
          root: instance(),
          positioning: this.positioning(),
          stale: stale(),
          typingPause: this.typingPause(),
          ...(value !== undefined ? { value: (value as ComboboxValue | undefined) ?? null } : {}),
          defaultValue:
            (untracked(this.defaultValue) as ComboboxValue | undefined) ?? (multiple ? [] : null),
          ...(inputValue !== undefined ? { inputValue } : {}),
          defaultInputValue: initialText,
          ...(open !== undefined ? { open } : {}),
          defaultOpen: this.defaultOpen(),
          onValueChange: (v: ComboboxValue, d: { event: { type: string } }) => {
            this.pending = true
            binding?.().report({ type: "change", value: v, user: true, composing: false })
            this.valueChangeDetails.emit({
              value: v as Value,
              details: { reason: reasonOf(d.event.type) },
            })
            this.valueChange.emit(v as Value)
          },
          onInputValueChange: (t: string, d: { event: { type: string } }) => {
            const reason = reasonOf(d.event.type)
            this.inputValueChangeDetails.emit({
              value: t,
              details: { reason, signal: nextSignal() },
            })
            this.inputValueChange.emit(t)
            // Free text: a field is a change of its value (field-control "Reporting Changes").
            if (this.freeText && !this.inlineMode) {
              binding?.().report({ type: "change", value: t, user: true, composing: false })
            }
            // Submit on choose: after the filled text is rendered into the input.
            if (
              this.freeText &&
              !this.inlineMode &&
              reason === "enter" &&
              untracked(this.submitOnChoose)
            ) {
              env.scheduler.setTimeout(() => {
                const el = env.dom.getById(idsNow().input) as HTMLInputElement | null
                el?.form?.requestSubmit()
              }, 0)
            }
          },
          onOpenChange: (o: boolean) => {
            // Closing the popup is a commit (field-control "Reporting Changes").
            if (!o) {
              binding?.().report({ type: "commit" })
              fetches?.abort()
            }
            this.openChange.emit(o)
          },
        }
      },
      env,
    )
    const { view, service, send } = machine
    const mirror = () => {
      const s = service()
      const snap = s.getSnapshot()
      openNow.set(snap.state === "open")
      query.set(
        patternQuery({
          inputValue: s.view().values.inputValue ?? "",
          dirty: snap.context.dirty,
          openReason: snap.context.openReason,
        }),
      )
    }
    this.reset = () => send({ type: "RESET" })
    this.autofill = (text) => {
      const before = untracked(view).values.value
      send({ type: "AUTOFILL", text })
      return untracked(view).values.value !== before
    }
    this.isOpen = () => view().matches("open")
    const mounted = signal<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    const modality = injectModality(env.modality, () => view().context.focused)
    const value = () => view().values.value as ComboboxValue
    this.keys = computed(() => {
      const v = value()
      return v == null ? [] : typeof v === "string" ? [v] : v
    })
    this.chipList = computed(() =>
      chipsOf(
        { items: full(), selectionMode: mode(), disabled: disabled(), readOnly: this.readOnly() },
        value(),
      ),
    )
    this.chips = this.chipList
    this.groups = computed(() => groupsOf(results()))
    const exposure = () => ({
      open: view().matches("open"),
      results: results(),
      query: query(),
      itemsQuery: this.itemsQuery(),
      loading: this.loading(),
    })
    this.formInput = hiddenFormInput(
      {
        input: () => this.constraint,
        // Sound: the Input part renders an <input> with this id.
        control: () => env.dom.getById(idsNow().input) as HTMLElement | null,
      },
      env,
    )
    this.api = computed(() => {
      const v = view()
      const open = v.matches("open")
      const m = mounted()
      const f = field()
      const inline = this.inlineMode
      const freeText = this.freeText
      const page = this.page()
      return comboboxConnect(
        {
          instance: instance(),
          open,
          exposed: isExposed(exposure()),
          empty: isEmptyState(exposure()),
          present: inline || this.present() || open,
          results: results(),
          context: v.context,
          selection: selectionOf(value()),
          selectionMode: mode(),
          inputValue: v.values.inputValue as string,
          hasValue: Array.isArray(value()) ? (value() as string[]).length > 0 : value() != null,
          disabled: disabled(),
          readOnly: f.readOnly,
          invalid: f.invalid,
          required: f.required,
          field: f,
          fieldData: binding?.().data,
          autoComplete: this.autoComplete() ?? "list",
          loading: this.loading(),
          modality: modality(),
          dir: env.locale.dir(),
          messages: messages(),
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          topLayer: this.topLayer(),
          // Free text: the visible input carries the name (no hidden input).
          name: freeText ? undefined : f.name,
          inputName: freeText && !inline ? (this.inputName() ?? f.name) : this.inputName(),
          inline,
          pageKey: page?.key,
          canBack: this.onBack() !== undefined && (page?.depth ?? 0) > 0,
          escapeCloses: inline && this.requestClose() !== undefined,
          clearOnEscape: this.clearOnEscape(),
          formAutoComplete: this.formAutoComplete(),
          form: this.form(),
          keys: this.keys(),
          chips: this.chipList(),
          send,
        },
        env,
      )
    })
    let loadedFor: Collection<unknown> | null = null
    this.list = {
      name: "Combobox",
      // Sound: the combobox api has every listbox part the shared parts call.
      parts: () =>
        ({ ...this.api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results(),
      registry: () => (this.collection() || data() ? null : registry),
      listed: (key) => results().has(key),
      mount: (part, on) => {
        const m = untracked(mounted)
        if (m[part] !== on) mounted.set({ ...m, [part]: on })
      },
      mountDescription: (key, on) => {
        const m = untracked(mounted)
        if (m.descriptions.has(key) === on) return
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.set({ ...m, descriptions: next })
      },
      requestLoadMore: () => {
        if ((untracked(this.loading) ?? "idle") !== "idle" || loadedFor === untracked(full)) {
          return
        }
        loadedFor = untracked(full)
        untracked(this.onLoadMore)?.()
      },
      instance: () => instance(),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      mirror()
      destroy.onDestroy(service().subscribe(mirror))
      // Known after render: the server render and hydration never carry `popover`.
      this.topLayer.set(
        typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype,
      )
      if (binding) {
        const id = idsNow().input
        destroy.onDestroy(
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
                this.freeText ? (env.dom.getById(id) as HTMLInputElement | null) : this.constraint,
              value: () =>
                this.freeText ? untracked(view).values.inputValue : untracked(view).values.value,
            },
            id,
          ),
        )
      }
      // Free text: a form reset restores the default text (no hidden input carries it).
      if (this.freeText && !this.inlineMode) {
        const onReset = (e: Event) => {
          const el = env.dom.getById(idsNow().input) as HTMLInputElement | null
          if (el && e.target === el.form && !e.defaultPrevented) send({ type: "RESET" })
        }
        document.addEventListener("reset", onReset)
        destroy.onDestroy(() => document.removeEventListener("reset", onReset))
      }
    })
    // Inline: a new query or page starts the list at the top (dip/cmdk#389).
    const injector = inject(Injector)
    const ready = injectRendered()
    effect(() => {
      if (!ready() || !this.inlineMode) return
      view().values.inputValue
      this.page()?.key
      untracked(() =>
        afterNextRender(
          () => {
            // The list's own scroller (the list, or the nearest scrolling ancestor), never the page's.
            let el = env.dom.getById(idsNow().list) as HTMLElement | null
            const doc = el?.ownerDocument
            while (el && el !== doc?.body && el !== doc?.documentElement) {
              const overflow = el.ownerDocument.defaultView?.getComputedStyle(el).overflowY ?? ""
              if (/auto|scroll/.test(overflow)) {
                el.scrollTop = 0
                return
              }
              el = el.parentElement
            }
          },
          { injector },
        ),
      )
    })
  }
}

/**
 * The input's frame: `<div rindComboboxControl>` holding the Chips, the Input and the triggers;
 * it renders the chips' summary and the form's hidden inputs after its content.
 */
@Component({
  selector: "[rindComboboxControl]",
  exportAs: "rindComboboxControl",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><span [rindProps]="summaryProps()">{{ summary() }}</span>@if (!host.freeText) {<input #constraint [rindProps]="hiddenProps()" />@for (c of carriers(); track c["value"]) {<input [rindProps]="c" />}}`,
})
export class ComboboxControl {
  /** @internal */
  protected readonly host = injectHost("Control")
  /** @internal */
  protected readonly summaryProps = computed(() => this.host.api().chipsSummaryNode())
  /** @internal */
  protected readonly summary = computed(() => this.host.api().chipsSummary)
  /** @internal */
  protected readonly hiddenProps = computed(() => this.host.api().hiddenInput())
  /** @internal */
  protected readonly carriers = computed(() => this.host.api().carriers())
  private readonly constraintRef = viewChild<ElementRef<HTMLInputElement>>("constraint")

  constructor() {
    const host = this.host
    bindProps(() => host.api().control())
    if (inject(PLATFORM_ID) !== "browser") return
    // After every render the constraint input mirrors the selection; a user change dispatches.
    afterEveryRender(() => {
      host.constraint = this.constraintRef()?.nativeElement ?? null
      if (host.freeText) return
      host.formInput.sync({ values: untracked(host.keys) }, { dispatch: host.pending })
      host.pending = false
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      if (host.freeText) return
      destroy.onDestroy(
        host.formInput.track({
          onReset: host.reset,
          current: () => ({ values: untracked(host.keys) }),
          onNativeInput: (input) => host.autofill(input.value),
        }),
      )
    })
  }
}

/** The part's press, a forwarded label click only focusing it. */
function injectLabelAwarePress(onPress: (modality: Modality) => void, disabled: () => boolean) {
  const env = injectEnvironment()
  return injectPress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
    labelActivation: "focus",
  })
}

/** The text input: `<input rindComboboxInput>`. */
@Directive({ selector: "[rindComboboxInput]", exportAs: "rindComboboxInput" })
export class ComboboxInput {
  constructor() {
    const host = injectHost("Input")
    const el: Element = inject(ElementRef).nativeElement
    const press = injectLabelAwarePress(
      (m) => untracked(host.api).pressInput(m),
      () => host.disabledState(),
    )
    bindProps(() => joinHandlers(host.api().input(), press.props))
    if (inject(PLATFORM_ID) !== "browser") return
    // The completed suffix is selected, so the next keystroke replaces it.
    let last: string | undefined
    afterEveryRender(() => {
      const range = untracked(host.api).completionRange
      const key = range?.join(",")
      if (key === last) return
      last = key
      const input = el as HTMLInputElement
      if (range && input.ownerDocument.activeElement === input) {
        input.setSelectionRange(range[0], range[1], "forward")
      }
    })
  }
}

/** Inline: popup parts render nothing (combobox "Anatomy"). */
function injectWarnInline(host: PopupHost, part: string) {
  if (inject(PLATFORM_ID) !== "browser" || !isDevMode()) return
  afterNextRender(() => {
    if (host.inlineMode) {
      console.warn(`[rind-ui] ${host.popupName}: an inline combobox renders no ${part}.`)
    }
  })
}

/** Opens the popup: `<button rindComboboxTrigger>`. */
@Directive({ selector: "[rindComboboxTrigger]", exportAs: "rindComboboxTrigger" })
export class ComboboxTrigger {
  constructor() {
    const host = injectHost("Trigger")
    injectWarnInline(host, "Trigger")
    const press = injectLabelAwarePress(
      (m) => untracked(host.api).pressTrigger(m),
      () => host.disabledState(),
    )
    bindProps(() => {
      const api = host.api()
      return host.inlineMode
        ? absentProps("combobox", api.trigger()["data-instance"] as string)
        : joinHandlers(api.trigger(), press.props)
    })
  }
}

/** Clears the text and the value: `<button rindComboboxClearTrigger>`. */
@Directive({ selector: "[rindComboboxClearTrigger]", exportAs: "rindComboboxClearTrigger" })
export class ComboboxClearTrigger {
  constructor() {
    const host = injectHost("ClearTrigger")
    bindProps(() => host.api().clearTrigger())
  }
}

/** The loading status: `<div rindComboboxLoading>`. */
@Directive({ selector: "[rindComboboxLoading]", exportAs: "rindComboboxLoading" })
export class ComboboxLoading {
  constructor() {
    const host = injectHost("Loading")
    bindProps(() => host.api().loading())
  }
}

/** Places the popup against the control: `<div rindComboboxPositioner>`, in the top layer. */
@Directive({
  selector: "[rindComboboxPositioner], [rindTagsInputPositioner]",
  exportAs: "rindComboboxPositioner",
})
export class ComboboxPositioner {
  constructor() {
    const host = injectPopupHost("Positioner")
    injectWarnInline(host, "Positioner")
    const el: Element = inject(ElementRef).nativeElement
    // It holds the popup: it stays while the popup's exit animations run.
    const presence = injectPresence(() => host.isOpen(), el, {
      keepMounted: () => host.keepMounted(),
      subtree: () => true,
    })
    effect(() => {
      const m = presence.mounted()
      untracked(() => host.present.set(m))
    })
    bindProps(() => {
      if (!presence.mounted() || host.inlineMode) {
        return absentProps(host.popupScope, host.list.instance())
      }
      const own = host.api().positioner()
      return {
        ...own,
        hidden: own["hidden"] === true || (!host.isOpen() && host.keepMounted()) || undefined,
      }
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Into the top layer while rendered (`popover="manual"`): above every stacking context of
    // the page, with no portal. Engines without the Popover API keep it in place.
    const ready = injectRendered()
    effect((onCleanup) => {
      const shown = ready() && presence.mounted() && host.topLayer() && !host.inlineMode
      const pop = el as HTMLElement & { showPopover?: () => void }
      if (!shown || typeof pop.showPopover !== "function") return
      untracked(() =>
        afterNextRender(
          () => {
            try {
              if (!pop.matches(":popover-open")) pop.showPopover()
            } catch {
              // Already shown, or not connected yet: the next render retries.
            }
          },
          { injector },
        ),
      )
      onCleanup(() => {
        try {
          if (pop.matches(":popover-open")) pop.hidePopover()
        } catch {
          // Removed with its subtree.
        }
      })
    })
    const injector = inject(Injector)
  }
}

/** The popup: `<div rindComboboxPopup>`, holding the List. */
@Directive({
  selector: "[rindComboboxPopup], [rindTagsInputPopup]",
  exportAs: "rindComboboxPopup",
})
export class ComboboxPopup {
  constructor() {
    const host = injectPopupHost("Popup")
    injectWarnInline(host, "Popup")
    const el: Element = inject(ElementRef).nativeElement
    const presence = injectPresence(() => host.isOpen(), el, {
      keepMounted: () => host.keepMounted(),
    })
    bindProps(() => {
      if (!presence.mounted() || host.inlineMode) {
        return absentProps(host.popupScope, host.list.instance())
      }
      const exiting = !host.isOpen() && presence.state() === "exiting"
      return { ...host.api().popup(), ...(exiting ? { inert: "" } : {}) }
    })
  }
}

/**
 * The chips toolbar (multiple): `<div rindComboboxChips>`, before the Input, holding one Chip
 * per selected option (`@for (c of cb.chips(); track c.key)`); empty, it renders each chip's
 * text and a remove button itself.
 */
@Component({
  selector: "[rindComboboxChips]",
  exportAs: "rindComboboxChips",
  imports: [forwardRef(() => ComboboxChip), forwardRef(() => ComboboxChipRemove)],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@for (c of host.chips(); track c.key) {<span rindComboboxChip [chip]="c.key">{{ c.text }}<button rindComboboxChipRemove></button></span>}</ng-content>`,
})
export class ComboboxChips {
  /** @internal */
  protected readonly host = injectHost("Chips")
  constructor() {
    bindProps(() => this.host.api().chips())
  }
}

const CHIP = new InjectionToken<ComboboxChip>("rind-ui.combobox-chip")

/** One selected option: `<span rindComboboxChip [chip]="c.key">`. */
@Directive({
  selector: "[rindComboboxChip]",
  exportAs: "rindComboboxChip",
  providers: [{ provide: CHIP, useExisting: forwardRef(() => ComboboxChip) }],
})
export class ComboboxChip {
  /** The chip's option key. */
  readonly chip = input.required<string>()
  constructor() {
    const host = injectHost("Chip")
    bindProps(() => host.api().chip(this.chip()), { owns: ["chip"] })
  }
}

/** Removes its chip: `<button rindComboboxChipRemove>` (default content `×`, hidden). */
@Component({
  selector: "[rindComboboxChipRemove]",
  exportAs: "rindComboboxChipRemove",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content><span aria-hidden="true">×</span></ng-content>`,
})
export class ComboboxChipRemove {
  constructor() {
    const host = injectHost("ChipRemove")
    const chip = inject(CHIP, { optional: true })
    if (!chip) throw new Error("rindComboboxChipRemove must be inside rindComboboxChip")
    bindProps(() => host.api().chipRemove(chip.chip()))
  }
}

/** The Combobox's parts (its options are the Listbox's, `rindComboboxItem` and the rest). */
export const Combobox = [
  ComboboxRoot,
  ListboxLabel,
  ComboboxControl,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxClearTrigger,
  ComboboxLoading,
  ComboboxPositioner,
  ComboboxPopup,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipRemove,
  ListboxList,
  ListboxItem,
  ListboxItemText,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxSection,
  ListboxSeparator,
  ListboxEmpty,
  ListboxLoadMore,
] as const
