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
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import { createPopupParts } from "./popup-parts"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
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

type Api = ReturnType<typeof comboboxConnect>

interface Host {
  readonly api: () => Api
  readonly open: () => boolean
  readonly disabled: () => boolean
  readonly chips: () => readonly ChipData[]
  readonly keys: () => readonly string[]
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly constraint: ShallowRef<HTMLInputElement | null>
  /** A user change happened since the last sync (the hidden input dispatches events). */
  readonly pending: { current: boolean }
  readonly reset: () => void
  readonly autofill: (text: string) => boolean
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: () => boolean
  readonly inline: boolean
  readonly freeText: boolean
}

const HostKey: InjectionKey<Host> = Symbol("rind-ui.combobox")
const ListKey: InjectionKey<ListboxHost> = Symbol("rind-ui.combobox-listbox")
function useHost(part: string): Host {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`Combobox.${part} must be inside Combobox.Root`)
  return host
}

type Slots = SlotsType<{ default?: () => VNodeChild }>
type Value = string | null | readonly string[]
const valueType = [String, Array] as PropType<Value>
/** A boolean whose absence means the machine's default. */
const flag = { type: Boolean, default: undefined }

const Root = defineComponent({
  name: "ComboboxRoot",
  props: {
    /** The base of the generated part ids. Default: a generated id. */
    id: String,
    items: Array as PropType<readonly ComboboxItemData[]>,
    /** A collection built by the consumer (virtualized or async lists). */
    collection: Object as PropType<Collection<unknown>>,
    /** Free text (`"none"`: an autocomplete, the text is the value). */
    selectionMode: String as PropType<"none" | "single" | "multiple">,
    multiple: Boolean,
    /** The value (`v-model`): a key or null; with `multiple`, the keys. */
    modelValue: { type: valueType, default: undefined },
    defaultValue: { type: valueType, default: undefined },
    /** The text (`v-model:inputValue`). */
    inputValue: { type: String, default: undefined },
    defaultInputValue: String,
    /** Controlled visibility (`v-model:open`). */
    open: flag,
    defaultOpen: flag,
    allowCustomValue: flag,
    /** Multiple: Backspace in the empty input arms, then removes, the last chip. */
    removeOnBackspace: flag,
    closeOnSelect: flag,
    /** Multiple: clears the text after a choice. Default: true. */
    clearInputOnSelect: flag,
    selectOnTab: flag,
    /** Opens when the text changes. Default: true. */
    openOnInput: flag,
    /** ArrowDown / ArrowUp in the input open the popup. Default: true. */
    openOnArrow: flag,
    openOnInputPress: flag,
    openOnFocus: flag,
    autoHighlight: flag,
    /** Keeps a pointer highlight when the pointer leaves the list. Default: false (true inline). */
    keepHighlight: flag,
    autoComplete: String as PropType<"list" | "both">,
    /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
    filter: { type: [Function, null] as PropType<ComboboxFilter>, default: undefined },
    /** The query the given collection answers (async): another query's results are stale. */
    itemsQuery: String,
    loading: String as PropType<LoadingStatus>,
    /** The items are virtualized: highlight scrolling goes through `scrollToIndex`. */
    virtualized: flag,
    /** Scrolls the highlighted item into view instead of the native `scrollIntoView`. */
    scrollToIndex: Function as PropType<(details: ScrollToIndexDetails) => void>,
    disabled: flag,
    readOnly: flag,
    invalid: flag,
    required: flag,
    /** Clearing the text keeps the selection instead of emptying it. */
    disallowEmptySelection: flag,
    /** Wraps the highlight at the ends of the list. Default: false. */
    loop: flag,
    messages: Object as PropType<Partial<ComboboxMessages>>,
    /** Side, align, offset, collisions. */
    positioning: Object as PropType<PositioningProps>,
    /** Keep the popup in the DOM (hidden) while closed. */
    keepMounted: Boolean,
    /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
    typingPause: Number,
    /** The form name of the selected key(s); the visible text is not submitted. */
    name: String,
    /** Submits the visible text under this name too. */
    inputName: String,
    /** The id of the form the hidden inputs belong to. */
    form: String,
    /** The list in place, always shown, items emit `action` (a command palette). Fixed. */
    inline: Boolean,
    /** Inline: the current page (`depth` 0: the root page). */
    page: Object as PropType<ComboboxPage>,
    /** Free text: Escape on a closed popup clears the text (default false). */
    clearOnEscape: flag,
    /** Free text: Enter on a highlighted suggestion fills, then submits the form. */
    submitOnChoose: Boolean,
    /** Free text: the input's native `autocomplete` (default "off"). */
    formAutoComplete: String,
    /** Inline: Backspace on an empty query above the root page (a listener makes it possible). */
    onBack: Function as PropType<() => void>,
    /** Inline: a listener lets Escape ask to close. */
    onOpenChange: Function as PropType<(open: boolean, details: ComboboxChangeDetails) => void>,
    onLoadMore: Function as PropType<() => void>,
  },
  emits: {
    valueChange: (_value: Value, _details: ComboboxChangeDetails) => true,
    "update:modelValue": (_value: Value) => true,
    inputValueChange: (_text: string, _details: ComboboxInputChangeDetails) => true,
    "update:inputValue": (_text: string) => true,
    "update:open": (_open: boolean) => true,
    /** Runs an item (inline), or follows a choice (free text). */
    action: (_key: string, _details: ComboboxActionDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { slots, emit }) {
    const base = useEnvironment(announcerCapability, layoutCapability)
    const env = { ...base, position: domPositioning(base) }
    // field-control: the Field's and an enclosing Fieldset's flags, OR-merged with our own.
    const binding = useFieldControl()
    const fieldsetDisabled = useFieldsetDisabled()
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "combobox",
          labelable: true,
          disabled: props.disabled === true || fieldsetDisabled.value,
          readOnly: props.readOnly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
        },
        binding?.value ?? null,
      ),
    )
    const disabled = () => field.value.disabled
    const instance = useRootId(() => props.id)
    const { collection: registered, registry } = useCollectionItems()
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const full = () => props.collection ?? data.value ?? registered.value ?? EMPTY
    const multiple = props.multiple
    // Fixed for the instance's life: the machine definition (states from props, design §1).
    const inline = props.inline
    const freeText = inline || props.selectionMode === "none"
    if (
      process.env.NODE_ENV !== "production" &&
      inline &&
      (multiple || props.selectionMode === "single")
    ) {
      console.error('[rind-ui] Combobox: `inline` implies selectionMode "none".')
    }
    const selectionMode: "none" | "single" | "multiple" = freeText
      ? "none"
      : multiple
        ? "multiple"
        : "single"
    // One object per page: a parent re-rendering a literal `page` is no page change.
    const page = computed(() =>
      props.page?.key === undefined
        ? undefined
        : { key: props.page.key, label: props.page.label ?? "", depth: props.page.depth ?? 0 },
    )
    const pageKeyed = shallowRef(page.value)
    watch(
      [() => props.page?.key, () => props.page?.label, () => props.page?.depth],
      () => (pageKeyed.value = page.value),
    )
    const ids = comboboxIds(instance())
    const locale = () => env.locale.locale()
    const messages = computed(() => ({ ...comboboxMessages, ...props.messages }))
    const pending = { current: false }
    // One controller per reported text; the previous one is aborted.
    let fetches: AbortController | null = null
    const nextSignal = () => {
      fetches?.abort()
      fetches = new AbortController()
      return fetches.signal
    }
    const constraint = shallowRef<HTMLInputElement | null>(null)
    // The selection's text is the initial text (no change callback for it at mount).
    const initialText = (() => {
      if (props.defaultInputValue !== undefined) return props.defaultInputValue
      const v = props.modelValue ?? props.defaultValue
      return typeof v === "string" && !multiple ? (full().get(toKey(v))?.textValue ?? "") : ""
    })()
    // The results answer the snapshot's query: mirrored here, so the props follow it.
    const query = shallowRef("")
    const openNow = shallowRef(false)
    const live = computed(() => patternResults(full(), query.value, props.filter, locale()))
    // While closing, the listed options are those of the moment it started closing.
    let frozen = live.value
    const results = computed(() => {
      const l = live.value
      if (openNow.value) frozen = l
      return openNow.value ? l : frozen
    })
    const stale = () => isStale({ itemsQuery: props.itemsQuery, query: query.value })
    const { view, service } = useMachine(
      // Sound: both definitions come from one setup (same props, events, context and values).
      (inline ? inlineComboboxMachine : comboboxMachine) as typeof comboboxMachine,
      () => ({
        items: full(),
        collection: results.value,
        ids,
        strategy: "active-descendant" as const,
        selectionMode,
        disabled: disabled(),
        readOnly: field.value.readOnly,
        disallowEmptySelection: props.disallowEmptySelection,
        loop: props.loop,
        loading: props.loading,
        onLoadMore: props.onLoadMore,
        virtualized: props.virtualized,
        scrollToIndex: props.scrollToIndex,
        allowCustomValue: props.allowCustomValue,
        removeOnBackspace: props.removeOnBackspace,
        closeOnSelect: props.closeOnSelect,
        clearInputOnSelect: props.clearInputOnSelect,
        selectOnTab: props.selectOnTab,
        openOnInput: props.openOnInput,
        openOnArrow: props.openOnArrow,
        openOnInputPress: props.openOnInputPress,
        openOnFocus: props.openOnFocus,
        autoHighlight: props.autoHighlight ?? (inline ? true : undefined),
        keepHighlight: props.keepHighlight ?? (inline ? true : undefined),
        clearOnEscape: props.clearOnEscape,
        onAction: (k: string, d: ComboboxActionDetails) => emit("action", k, d),
        page: pageKeyed.value,
        onBack: props.onBack ? () => props.onBack?.() : undefined,
        requestClose:
          inline && props.onOpenChange
            ? () => props.onOpenChange?.(false, { reason: "escape" })
            : undefined,
        autoComplete: props.autoComplete,
        locale: locale(),
        messages: messages.value,
        root: instance(),
        positioning: props.positioning,
        stale: stale(),
        typingPause: props.typingPause,
        ...(props.modelValue !== undefined
          ? { value: (props.modelValue as ComboboxValue | undefined) ?? null }
          : {}),
        defaultValue: (props.defaultValue as ComboboxValue | undefined) ?? (multiple ? [] : null),
        ...(props.inputValue !== undefined ? { inputValue: props.inputValue } : {}),
        defaultInputValue: initialText,
        ...(props.open !== undefined ? { open: props.open } : {}),
        defaultOpen: props.defaultOpen,
        onValueChange: (v: ComboboxValue, d: { event: { type: string } }) => {
          pending.current = true
          binding?.value.report({ type: "change", value: v, user: true, composing: false })
          emit("valueChange", v as Value, { reason: reasonOf(d.event.type) })
          emit("update:modelValue", v as Value)
        },
        onInputValueChange: (t: string, d: { event: { type: string } }) => {
          const reason = reasonOf(d.event.type)
          emit("inputValueChange", t, { reason, signal: nextSignal() })
          emit("update:inputValue", t)
          // Free text: a field is a change of its value (field-control "Reporting Changes").
          if (freeText && !inline) {
            binding?.value.report({ type: "change", value: t, user: true, composing: false })
          }
          // Submit on choose: after the filled text is rendered into the input.
          if (freeText && !inline && reason === "enter" && props.submitOnChoose) {
            env.scheduler.setTimeout(() => {
              const el = env.dom.getById(ids.input) as HTMLInputElement | null
              el?.form?.requestSubmit()
            }, 0)
          }
        },
        onOpenChange: (o: boolean, d: { event: { type: string } }) => {
          // Closing the popup is a commit (field-control "Reporting Changes").
          if (!o) {
            binding?.value.report({ type: "commit" })
            fetches?.abort()
          }
          props.onOpenChange?.(o, { reason: reasonOf(d.event.type) })
          emit("update:open", o)
        },
      }),
      env,
    )
    const mirror = () => {
      const snap = service.getSnapshot()
      openNow.value = snap.state === "open"
      query.value = patternQuery({
        inputValue: service.view().values.inputValue ?? "",
        dirty: snap.context.dirty,
        openReason: snap.context.openReason,
      })
    }
    mirror()
    onMounted(() => {
      mirror()
      onBeforeUnmount(service.subscribe(mirror))
    })
    if (binding) {
      onMounted(() =>
        onBeforeUnmount(
          binding.value.register(
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
                freeText
                  ? (env.dom.getById(ids.input) as HTMLInputElement | null)
                  : constraint.value,
              value: () =>
                freeText ? service.view().values.inputValue : service.view().values.value,
            },
            ids.input,
          ),
        ),
      )
    }
    // Free text: a form reset restores the default text (no hidden input carries it).
    if (freeText && !inline) {
      onMounted(() => {
        const onReset = (e: Event) => {
          const el = env.dom.getById(ids.input) as HTMLInputElement | null
          if (el && e.target === el.form && !e.defaultPrevented) service.send({ type: "RESET" })
        }
        document.addEventListener("reset", onReset)
        onBeforeUnmount(() => document.removeEventListener("reset", onReset))
      })
    }
    const present = shallowRef(false)
    // Known after mount: the server render and hydration never carry `popover`.
    const topLayer = shallowRef(false)
    onMounted(() => {
      topLayer.value = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
    })
    const mounted = shallowRef<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    const modality = useModality(env.modality, () => view.value.context.focused)
    const value = () => view.value.values.value as ComboboxValue
    const keys = computed(() => {
      const v = value()
      return v == null ? [] : typeof v === "string" ? [v] : v
    })
    const chips = computed(() =>
      chipsOf(
        { items: full(), selectionMode, disabled: disabled(), readOnly: props.readOnly },
        value(),
      ),
    )
    const exposure = () => ({
      open: view.value.matches("open"),
      results: results.value,
      query: query.value,
      itemsQuery: props.itemsQuery,
      loading: props.loading,
    })
    const formInput = hiddenFormInput(
      {
        input: () => constraint.value,
        // Sound: the Input part renders an <input> with this id.
        control: () => env.dom.getById(ids.input) as HTMLElement | null,
      },
      env,
    )
    const api = computed(() => {
      const v = view.value
      const open = v.matches("open")
      const m = mounted.value
      const f = field.value
      return comboboxConnect(
        {
          instance: instance(),
          open,
          exposed: isExposed(exposure()),
          empty: isEmptyState(exposure()),
          present: inline || present.value || open,
          results: results.value,
          context: v.context,
          selection: selectionOf(value()),
          selectionMode,
          inputValue: v.values.inputValue as string,
          hasValue: Array.isArray(value()) ? (value() as string[]).length > 0 : value() != null,
          disabled: disabled(),
          readOnly: f.readOnly,
          invalid: f.invalid,
          required: f.required,
          field: f,
          fieldData: binding?.value.data,
          autoComplete: props.autoComplete ?? "list",
          loading: props.loading,
          modality: modality.value,
          dir: env.locale.dir(),
          messages: messages.value,
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          topLayer: topLayer.value,
          // Free text: the visible input carries the name (no hidden input).
          name: freeText ? undefined : f.name,
          inputName: freeText && !inline ? (props.inputName ?? f.name) : props.inputName,
          inline,
          pageKey: props.page?.key,
          canBack: props.onBack !== undefined && (props.page?.depth ?? 0) > 0,
          escapeCloses: inline && props.onOpenChange !== undefined,
          clearOnEscape: props.clearOnEscape,
          formAutoComplete: props.formAutoComplete,
          form: props.form,
          keys: keys.value,
          chips: chips.value,
          send: service.send,
        },
        env,
      )
    })
    let loadedFor: Collection<unknown> | null = null
    provide(HostKey, {
      api: () => api.value,
      open: () => view.value.matches("open"),
      disabled,
      chips: () => chips.value,
      keys: () => keys.value,
      formInput,
      constraint,
      pending,
      reset: () => service.send({ type: "RESET" }),
      autofill: (text) => {
        const before = service.view().values.value
        service.send({ type: "AUTOFILL", text })
        return service.view().values.value !== before
      },
      keepMounted: () => props.keepMounted,
      setPresent: (p) => (present.value = p),
      topLayer: () => topLayer.value,
      inline,
      freeText,
    })
    provide(ListKey, {
      name: "Combobox",
      // Sound: the combobox api has every listbox part the shared parts call.
      parts: () =>
        ({ ...api.value, isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results.value,
      registry: props.collection || data.value ? null : registry,
      listed: (key) => results.value.has(key),
      mount: (part, on) => {
        if (mounted.value[part] !== on) mounted.value = { ...mounted.value, [part]: on }
      },
      mountDescription: (key, on) => {
        if (mounted.value.descriptions.has(key) === on) return
        const next = new Set(mounted.value.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.value = { ...mounted.value, descriptions: next }
      },
      requestLoadMore: () => {
        if ((props.loading ?? "idle") !== "idle" || loadedFor === full()) return
        loadedFor = full()
        props.onLoadMore?.()
      },
    })
    // Inline: a new query or page starts the list at the top (dip/cmdk#389).
    if (inline) {
      onMounted(() =>
        watch(
          [() => view.value.values.inputValue, () => props.page?.key],
          () => {
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
          },
          { flush: "post" },
        ),
      )
    }
    return () => slots.default?.()
  },
})

/** A part with no state of its own. */
function simplePart(name: string, tag: string, pick: (a: Api) => Record<string, unknown>) {
  return defineComponent({
    name: `Combobox${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const host = useHost(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(pick(host.api()) as never), attrs),
          slots.default?.(),
          props.asChild,
        )
    },
  })
}

const Label = defineComponent({
  name: "ComboboxLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Label")
    const list = inject(ListKey) as ListboxHost
    onMounted(() => list.mount("label", true))
    onBeforeUnmount(() => list.mount("label", false))
    return () =>
      renderPart(
        "label",
        mergeProps(normalizeProps(host.api().label()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Control = defineComponent({
  name: "ComboboxControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Control")
    // After every update the constraint input mirrors the selection; a user change dispatches.
    const sync = () => {
      if (host.freeText) return
      host.formInput.sync({ values: host.keys() }, { dispatch: host.pending.current })
      host.pending.current = false
    }
    onMounted(() => {
      sync()
      if (!host.freeText) {
        onBeforeUnmount(
          host.formInput.track({
            onReset: host.reset,
            current: () => ({ values: host.keys() }),
            onNativeInput: (input) => host.autofill(input.value),
          }),
        )
      }
      // The value changed without this part updating.
      watch(() => host.keys().join("\u0000"), sync, { flush: "post" })
    })
    onUpdated(sync)
    return () => {
      const api = host.api()
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.control()), attrs),
        h(Fragment, [
          slots.default?.(),
          h("span", normalizeProps(api.chipsSummaryNode()), api.chipsSummary),
          // Inside the Control: the browser's validation message is anchored near it.
          ...(host.freeText
            ? []
            : [
                h("input", {
                  ...normalizeProps(api.hiddenInput()),
                  ref: refTo(host.constraint as ShallowRef<Element | null>),
                }),
                ...api
                  .carriers()
                  .map((p) => h("input", { key: String(p["value"]), ...normalizeProps(p) })),
              ]),
        ]),
        props.asChild,
      )
    }
  },
})

/** The part's press, a forwarded label click only focusing it. */
function useLabelAwarePress(onPress: (modality: Modality) => void, disabled: () => boolean) {
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

const Input = defineComponent({
  name: "ComboboxInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const host = useHost("Input")
    const press = useLabelAwarePress((m) => host.api().pressInput(m), host.disabled)
    const el = shallowRef<Element | null>(null)
    // The completed suffix is selected, so the next keystroke replaces it.
    onMounted(() =>
      watch(
        () => host.api().completionRange?.join(","),
        () => {
          const range = host.api().completionRange
          const input = el.value as HTMLInputElement | null
          if (range && input && input.ownerDocument.activeElement === input) {
            input.setSelectionRange(range[0], range[1], "forward")
          }
        },
        { flush: "post", immediate: true },
      ),
    )
    return () =>
      renderPart(
        "input",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(host.api().input()), press.props),
            ref: refTo(el),
          },
          attrs,
        ),
        undefined,
        props.asChild,
      )
  },
})

/** Inline: popup parts render nothing (combobox "Anatomy"). */
function warnInline(host: Host, part: string) {
  if (host.inline && process.env.NODE_ENV !== "production") {
    onMounted(() => console.warn(`[rind-ui] Combobox: an inline combobox renders no ${part}.`))
  }
}

const Trigger = defineComponent({
  name: "ComboboxTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Trigger")
    warnInline(host, "Trigger")
    const press = useLabelAwarePress((m) => host.api().pressTrigger(m), host.disabled)
    return () =>
      host.inline
        ? null
        : renderPart(
            "button",
            mergeProps(joinHandlers(normalizeProps(host.api().trigger()), press.props), attrs),
            slots.default?.(),
            props.asChild,
          )
  },
})

const ClearTrigger = simplePart("ClearTrigger", "button", (a) => a.clearTrigger())
const Loading = simplePart("Loading", "div", (a) => a.loading())

const { Positioner, Popup } = createPopupParts(useHost, "Combobox")

const ChipKey: InjectionKey<string> = Symbol("rind-ui.combobox-chip")
const useChipKey = (part: string) => {
  const key = inject(ChipKey, null)
  if (key === null) throw new Error(`Combobox.${part} must be inside Combobox.Chips`)
  return key
}

/** Provides one chip's key to the parts inside it. */
const ChipScope = defineComponent({
  name: "ComboboxChipScope",
  props: { chip: { type: String, required: true } },
  setup(props, { slots }) {
    provide(ChipKey, props.chip)
    return () => slots["default"]?.()
  },
})

const Chip = defineComponent({
  name: "ComboboxChip",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Chip")
    const key = useChipKey("Chip")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.api().chip(key)), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ChipRemove = defineComponent({
  name: "ComboboxChipRemove",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ChipRemove")
    const key = useChipKey("ChipRemove")
    return () =>
      renderPart(
        "button",
        mergeProps(normalizeProps(host.api().chipRemove(key)), attrs),
        slots.default?.() ?? h("span", { "aria-hidden": "true" }, "×"),
        props.asChild,
      )
  },
})

/** The chips toolbar (multiple): one Chip per selected option, before the Input. */
const Chips = defineComponent({
  name: "ComboboxChips",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    /** Renders one chip; default: its text and a remove button. */
    default?: (chip: ChipData) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const host = useHost("Chips")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(host.api().chips()), attrs),
        host
          .chips()
          .map((chip) =>
            h(ChipScope, { key: chip.key, chip: chip.key }, () =>
              slots.default ? slots.default(chip) : h(Chip, null, () => [chip.text, h(ChipRemove)]),
            ),
          ),
        props.asChild,
      )
  },
})

const list = createListboxParts(ListKey, "Combobox")
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
