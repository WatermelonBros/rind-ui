<script lang="ts">
// Select: Root (service, hidden form input), Label, Trigger, ValueText, Indicator, Description,
// Portal, Positioner, Content and the listbox parts bound to this host. Wiring only: the
// machine owns opening, value and highlight; the core parts own every attribute.
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  domPositioning,
  getLayerStack,
  hiddenFormInput,
  type LayerMeta,
  layoutCapability,
  mergeFieldProps,
  type SelectOpenChangeDetails,
  type SelectValue,
  selectIds,
  selectionOf,
  selectLayerId,
  selectMachine,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useParentLayer } from "../layer-context"
import type { ListboxItemData } from "../listbox/types"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { api, type Mounted, selectHost } from "./context.svelte"
import type { SelectRootProps, SelectValueChangeDetails } from "./types"

let {
  id,
  items,
  collection: given,
  multiple = false,
  value = $bindable(),
  defaultValue,
  onValueChange,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  modal = true,
  disabled: ownDisabled,
  focusableWhenDisabled = false,
  readOnly,
  required,
  invalid,
  name,
  form,
  autoComplete,
  placeholder,
  loop = false,
  typeaheadTimeout = 1000,
  positioning,
  keepMounted = false,
  actions = $bindable(),
  children,
}: SelectRootProps = $props()

const fromData = (list: readonly ListboxItemData[]) =>
  createListCollection({
    items: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])
const VALUE_REASON: Record<string, SelectValueChangeDetails["reason"]> = {
  SELECT: "select",
  TYPEAHEAD: "typeahead",
  "FORM.RESET": "reset",
  "FORM.AUTOFILL": "autofill",
}

const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const parent = useParentLayer()
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const field = $derived(
  mergeFieldProps(
    {
      role: "combobox",
      labelable: true,
      disabled: ownDisabled,
      readOnly,
      required,
      invalid,
      ...(name === undefined ? {} : { name }),
    },
    enclosing?.() ?? null,
  ),
)
// A native <fieldset disabled> around the trigger, not only rind's Fieldset (radix#2417).
let fieldsetDom = $state(false)
const disabled = $derived(field.disabled || fieldsetDisabled() || fieldsetDom)
const items_ = useCollectionItems()
const data = $derived(items ? fromData(items) : null)
const collection = $derived(given ?? data ?? items_.collection ?? EMPTY)
const ids = untrack(() => {
  const s = selectIds(instance)
  return { list: s.list, item: s.item }
})
const shared = $state({
  trigger: null as HTMLElement | null,
  label: null as HTMLElement | null,
  hidden: null as HTMLInputElement | null,
  mounted: {
    label: false,
    description: false,
    list: false,
    empty: false,
    descriptions: new Set(),
  } as Mounted,
  meta: undefined as LayerMeta | undefined,
})
const formInput = hiddenFormInput(
  { input: () => shared.hidden, control: () => shared.trigger },
  env,
)
const machineEnv = { ...env, position: domPositioning(env) }
// A user change dispatches input + change from the hidden input after it commits.
let userChange = false
const machine = useMachine(
  selectMachine,
  () => ({
    collection,
    ids,
    strategy: "roving" as const,
    selectionMode: multiple ? ("multiple" as const) : ("single" as const),
    selectionBehavior: "toggle" as const,
    loop,
    focusableWhenDisabled,
    typeaheadTimeout,
    ...(value !== undefined ? { value: value as SelectValue } : {}),
    defaultValue: (defaultValue as SelectValue | undefined) ?? (multiple ? [] : null),
    onValueChange: (v: SelectValue, details: { event: { type: string } }) => {
      const reason = VALUE_REASON[details.event.type] ?? "select"
      if (reason !== "reset") userChange = true
      ;(onValueChange as ((v: unknown, d: SelectValueChangeDetails) => void) | undefined)?.(v, {
        reason,
      })
      if (value !== undefined) value = v as never
    },
    ...(open !== undefined ? { open } : {}),
    defaultOpen,
    onOpenChange: (o: boolean, d: SelectOpenChangeDetails) => {
      onOpenChange?.(o, d)
      if (open !== undefined) open = o
    },
    modal,
    disabled,
    readOnly: field.readOnly,
    positioning,
    root: instance,
    parent: parent(),
    getTrigger: () => shared.trigger,
    getLabel: () => shared.label,
  }),
  machineEnv,
)
untrack(() => {
  actions = {
    open: () => machine.send({ type: "OPEN" }),
    close: () => machine.send({ type: "CLOSE" }),
  }
})
$effect(() => {
  shared.meta = undefined
  if (!machine.view.matches("open")) return
  const layer = selectLayerId(instance)
  return untrack(() => {
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => {
      shared.meta = stack.get(layer)?.meta()
    }
    read()
    return stack.subscribe(read)
  })
})
const ctx = {
  service: machine.service,
  view: () => machine.view,
  instance: () => instance,
  collection: () => collection,
  registry: () => (given || data ? null : items_.registry),
  multiple: () => multiple,
  modal: () => modal,
  disabled: () => disabled,
  readOnly: () => field.readOnly,
  required: () => field.required,
  invalid: () => field.invalid,
  placeholder: () => placeholder,
  keepMounted: () => keepMounted,
  focusableWhenDisabled: () => focusableWhenDisabled,
  typeaheadTimeout: () => typeaheadTimeout,
  positioning: () => positioning,
  shared,
  // Untracked: parts call these from their effects, which must not depend on what they write.
  setMounted: (part: "label" | "description" | "list" | "empty", on: boolean) =>
    untrack(() => {
      if (shared.mounted[part] !== on) shared.mounted = { ...shared.mounted, [part]: on }
    }),
  mountDescription: (key: CollectionKey, on: boolean) =>
    untrack(() => {
      if (shared.mounted.descriptions.has(key) === on) return
      const next = new Set(shared.mounted.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      shared.mounted = { ...shared.mounted, descriptions: next }
    }),
  triggerNaming: { current: {} },
}
selectHost.set(ctx)
// The form's view of the value: one key (single) or the constraint plus value carriers.
const keys = $derived.by(() => {
  const k = selectionOf(machine.view.values.value)
  return k === "all" ? [] : [...k]
})
const mirror = () => ({
  value: multiple ? (keys.length > 0 ? "x" : "") : (keys[0] ?? ""),
})
// After every update of the value: the input shows it; a user change also fires input + change.
$effect(() => {
  void keys
  void shared.hidden
  untrack(() => {
    const dispatch = userChange
    userChange = false
    formInput.sync(mirror(), { dispatch })
  })
})
$effect(() => {
  const node = shared.trigger
  if (!node) return
  const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = watch.disabled
  return watch.stop
})
$effect(() =>
  untrack(() =>
    formInput.track({
      onReset: () => machine.send({ type: "FORM.RESET" }),
      current: mirror,
      onNativeInput: (input) => {
        machine.send({ type: "FORM.AUTOFILL", text: input.value })
        // Re-sync either way: an unmatched text (or a multiple select) leaves the machine as it
        // was, and the input must not keep what the browser wrote (select spec "Browser Autofill").
        return false
      },
    }),
  ),
)
const a = $derived(api(ctx, env))
const hiddenRef = (node: HTMLInputElement) => {
  shared.hidden = node
  return () => {
    if (shared.hidden === node) shared.hidden = null
  }
}
</script>

{@render children?.()}<input
  {...attrs(normalizeProps(a.hiddenInput({ name: field.name, form, autoComplete })))}
  {@attach hiddenRef}
/>{#if multiple && field.name}{#each keys as k (k)}<input
      {...attrs(normalizeProps(a.hiddenValue(k, { name: field.name, form })))}
    />{/each}{/if}
