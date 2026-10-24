<script lang="ts">
// Combobox (combobox + combobox-pattern specs): Root derives the listed results from the
// snapshot (patternResults) and passes them as the machine's collection; the list parts are
// the listbox parts under scope "combobox". Wiring only.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  type ComboboxActionDetails,
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
  layoutCapability,
  mergeFieldProps,
  patternQuery,
  patternResults,
  selectionOf,
  toKey,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { listboxHost } from "../listbox/context"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { comboboxHost, popupHost } from "./context"
import type { ComboboxItemData, ComboboxRootProps } from "./types"

let {
  id,
  items,
  collection: given,
  children,
  multiple = false,
  selectionMode: mode,
  value = $bindable(),
  defaultValue,
  onValueChange,
  inputValue = $bindable(),
  defaultInputValue,
  onInputValueChange,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  inline: inlineProp = false,
  ...p
}: ComboboxRootProps = $props()

const fromData = (list: readonly ComboboxItemData[]) =>
  createListCollection({
    items: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])
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

const base = useEnvironment(announcerCapability, layoutCapability)
const env = { ...base, position: domPositioning(base) }
const uid = $props.id()
const instance = $derived(id ?? uid)
// field-control: the Field's and an enclosing Fieldset's flags, OR-merged with our own.
const binding = useFieldControl(uid)
const fieldsetDisabled = useFieldsetDisabled()
const field = $derived(
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
const disabled = $derived(field.disabled)
const items_ = useCollectionItems()
const data = $derived(items ? fromData(items) : null)
const full = $derived(given ?? data ?? items_.collection ?? EMPTY)
// Fixed for the instance's life: the machine definition (states from props, design §1).
const inline = untrack(() => inlineProp)
const freeText = untrack(() => inline || mode === "none")
if (DEV && inline && untrack(() => multiple || mode === "single")) {
  console.error('[rind-ui] Combobox: `inline` implies selectionMode "none".')
}
const selectionMode: "none" | "single" | "multiple" = freeText
  ? "none"
  : untrack(() => multiple)
    ? "multiple"
    : "single"
// One object per page: a parent re-rendering a literal `page` is no page change.
const pageKey = $derived(p.page?.key)
const pageLabel = $derived(p.page?.label)
const pageDepth = $derived(p.page?.depth)
const page = $derived(
  pageKey === undefined
    ? undefined
    : { key: pageKey, label: pageLabel ?? "", depth: pageDepth ?? 0 },
)
const ids = untrack(() => comboboxIds(instance))
const locale = $derived(env.locale.locale())
const messages = $derived({ ...comboboxMessages, ...p.messages })
const pending = { current: false }
// One controller per reported text; the previous one is aborted.
let fetches: AbortController | null = null
const nextSignal = () => {
  fetches?.abort()
  fetches = new AbortController()
  return fetches.signal
}
let constraint: HTMLInputElement | null = null
// The selection's text is the initial text (no change callback for it at mount).
const initialText = untrack(() => {
  if (defaultInputValue !== undefined) return defaultInputValue
  const v = value ?? defaultValue
  return typeof v === "string" && !multiple ? (full.get(toKey(v))?.textValue ?? "") : ""
})
// The results answer the snapshot's query: mirrored here from the service (the props read it,
// and the machine's view reads the props).
let query = $state("")
let openNow = $state(false)
const live = $derived(patternResults(full, query, p.filter, locale))
// While closing, the listed options are those of the moment it started closing.
let frozen = untrack(() => live)
const results = $derived.by(() => {
  const l = live
  if (openNow) frozen = l
  return openNow ? l : frozen
})
const stale = $derived(isStale({ itemsQuery: p.itemsQuery, query }))
const machine = useMachine(
  // Sound: both definitions come from one setup (same props, events, context and values).
  (inline ? inlineComboboxMachine : comboboxMachine) as typeof comboboxMachine,
  () => ({
    items: full,
    collection: results,
    ids,
    strategy: "active-descendant" as const,
    selectionMode,
    disabled,
    readOnly: field.readOnly,
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
    page,
    onBack: p.onBack ? () => p.onBack?.() : undefined,
    requestClose:
      inline && onOpenChange ? () => onOpenChange?.(false, { reason: "escape" }) : undefined,
    autoComplete: p.autoComplete,
    locale,
    messages,
    root: instance,
    positioning: p.positioning,
    stale,
    typingPause: p.typingPause,
    ...(value !== undefined ? { value: (value as ComboboxValue | undefined) ?? null } : {}),
    defaultValue: (defaultValue as ComboboxValue | undefined) ?? (multiple ? [] : null),
    ...(inputValue !== undefined ? { inputValue } : {}),
    defaultInputValue: initialText,
    ...(open !== undefined ? { open } : {}),
    defaultOpen,
    onValueChange: (v: ComboboxValue, d: { event: { type: string } }) => {
      pending.current = true
      binding?.().report({ type: "change", value: v, user: true, composing: false })
      ;(onValueChange as ((v: unknown, d: unknown) => void) | undefined)?.(v, {
        reason: reasonOf(d.event.type),
      })
      if (value !== undefined) value = v as never
    },
    onInputValueChange: (t: string, d: { event: { type: string } }) => {
      const reason = reasonOf(d.event.type)
      onInputValueChange?.(t, { reason, signal: nextSignal() })
      if (inputValue !== undefined) inputValue = t
      // Free text: a field is a change of its value (field-control "Reporting Changes").
      if (freeText && !inline) {
        binding?.().report({ type: "change", value: t, user: true, composing: false })
      }
      // Submit on choose: after the filled text is rendered into the input.
      if (freeText && !inline && reason === "enter" && p.submitOnChoose) {
        env.scheduler.setTimeout(() => {
          const el = env.dom.getById(ids.input) as HTMLInputElement | null
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
      onOpenChange?.(o, { reason: reasonOf(d.event.type) })
      if (open !== undefined) open = o
    },
  }),
  env,
)
const mirror = () => {
  const snap = machine.service.getSnapshot()
  openNow = snap.state === "open"
  query = patternQuery({
    inputValue: machine.service.view().values.inputValue ?? "",
    dirty: snap.context.dirty,
    openReason: snap.context.openReason,
  })
}
$effect(() =>
  untrack(() => {
    mirror()
    return machine.service.subscribe(() => untrack(mirror))
  }),
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
        // Free text: the visible input is the form control and its own validity element.
        validityElement: () =>
          freeText ? (env.dom.getById(ids.input) as HTMLInputElement | null) : constraint,
        value: () =>
          freeText ? machine.service.view().values.inputValue : machine.service.view().values.value,
      },
      ids.input,
    ),
  )
})
// Free text: a form reset restores the default text (no hidden input carries it).
$effect(() => {
  if (!freeText || inline) return
  const onReset = (e: Event) => {
    const el = env.dom.getById(ids.input) as HTMLInputElement | null
    if (el && e.target === el.form && !e.defaultPrevented) machine.send({ type: "RESET" })
  }
  document.addEventListener("reset", onReset)
  return () => document.removeEventListener("reset", onReset)
})
let present = $state(false)
// Known after mount: the server render and hydration never carry `popover`.
let topLayer = $state(false)
$effect(() => {
  topLayer = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
})
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
const modality = useModality(env.modality, () => machine.view.context.focused)
const current = $derived(machine.view.values.value as ComboboxValue)
const keys = $derived(current == null ? [] : typeof current === "string" ? [current] : current)
const chips = $derived(
  chipsOf({ items: full, selectionMode, disabled, readOnly: p.readOnly }, current),
)
const exposure = $derived({
  open: machine.view.matches("open"),
  results,
  query,
  itemsQuery: p.itemsQuery,
  loading: p.loading,
})
const formInput = hiddenFormInput(
  {
    input: () => constraint,
    // Sound: the Input part renders an <input> with this id.
    control: () => env.dom.getById(ids.input) as HTMLElement | null,
  },
  env,
)
const api = $derived.by(() => {
  const v = machine.view
  const isOpen = v.matches("open")
  const m = mounted
  return comboboxConnect(
    {
      instance,
      open: isOpen,
      exposed: isExposed(exposure),
      empty: isEmptyState(exposure),
      present: inline || present || isOpen,
      results,
      context: v.context,
      selection: selectionOf(current),
      selectionMode,
      inputValue: v.values.inputValue as string,
      hasValue: Array.isArray(current) ? current.length > 0 : current != null,
      disabled,
      readOnly: field.readOnly,
      invalid: field.invalid,
      required: field.required,
      field,
      fieldData: binding?.().data,
      autoComplete: p.autoComplete ?? "list",
      loading: p.loading,
      modality: modality.current,
      dir: env.locale.dir(),
      messages,
      mounted: {
        label: m.label,
        empty: m.empty,
        description: (key) => m.descriptions.has(key),
      },
      topLayer,
      // Free text: the visible input carries the name (no hidden input).
      name: freeText ? undefined : field.name,
      inputName: freeText && !inline ? (p.inputName ?? field.name) : p.inputName,
      inline,
      pageKey: p.page?.key,
      canBack: p.onBack !== undefined && (p.page?.depth ?? 0) > 0,
      escapeCloses: inline && onOpenChange !== undefined,
      clearOnEscape: p.clearOnEscape,
      formAutoComplete: p.formAutoComplete,
      form: p.form,
      keys,
      chips,
      send: machine.service.send,
    },
    env,
  )
})
let loadedFor: Collection<unknown> | null = null
comboboxHost.set({
  api: () => api,
  open: () => machine.view.matches("open"),
  disabled: () => disabled,
  chips: () => chips,
  keys: () => keys,
  formInput,
  setConstraint: (el) => {
    constraint = el
  },
  pending,
  reset: () => machine.send({ type: "RESET" }),
  autofill: (text) => {
    const before = machine.service.view().values.value
    machine.send({ type: "AUTOFILL", text })
    return machine.service.view().values.value !== before
  },
  keepMounted: () => p.keepMounted === true,
  setPresent: (v) => {
    present = v
  },
  topLayer: () => topLayer,
  mountLabel: (on) => mount("label", on),
  inline,
  freeText,
})
popupHost.set({
  name: "Combobox",
  api: () => api,
  open: () => machine.view.matches("open"),
  keepMounted: () => p.keepMounted === true,
  setPresent: (v) => {
    present = v
  },
  topLayer: () => topLayer,
  inline,
})
listboxHost.set({
  name: "Combobox",
  // Sound: the combobox api has every listbox part the shared parts call.
  parts: () => ({ ...api, isEmpty: isEmptyState(exposure) }) as never,
  collection: () => results,
  registry: untrack(() => (given || data ? null : items_.registry)),
  listed: (key) => results.has(key),
  mount,
  mountDescription,
  requestLoadMore: () => {
    if ((p.loading ?? "idle") !== "idle" || loadedFor === full) return
    loadedFor = full
    p.onLoadMore?.()
  },
})
// Inline: a new query or page starts the list at the top (dip/cmdk#389).
$effect(() => {
  if (!inline) return
  void machine.view.values.inputValue
  void p.page?.key
  untrack(() => {
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
  })
})
</script>

{@render children?.()}
