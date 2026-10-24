// Select: Root (service, hidden form input), Label, Trigger, ValueText, Indicator, Description,
// Portal, Positioner, Content and the listbox parts bound to this host. Wiring only: the
// machine owns opening, value and highlight; the core parts own every attribute.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  domPositioning,
  focusSafely,
  getLayerStack,
  hiddenFormInput,
  type LayerMeta,
  layoutCapability,
  mergeFieldProps,
  type SelectOpenChangeDetails,
  type SelectValue,
  type Service,
  selectConnect,
  selectIds,
  selectionOf,
  selectLayerId,
  selectMachine,
  selectPositioning,
} from "@rind-ui/core"
import {
  type ComputedRef,
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
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import type { ListboxItemData } from "../listbox/listbox"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

/** `valueChange`'s details: why the value changed. */
export interface SelectValueChangeDetails {
  readonly reason: "select" | "typeahead" | "reset" | "autofill"
}

const VALUE_REASON: Record<string, SelectValueChangeDetails["reason"]> = {
  SELECT: "select",
  TYPEAHEAD: "typeahead",
  "FORM.RESET": "reset",
  "FORM.AUTOFILL": "autofill",
}

/** What the Root's template ref exposes. */
export interface SelectActions {
  open(): void
  close(): void
}

interface Mounted {
  readonly label: boolean
  readonly description: boolean
  readonly list: boolean
  readonly empty: boolean
  readonly descriptions: ReadonlySet<CollectionKey>
}

type View = ReturnType<Service<typeof selectMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof selectMachine>
  readonly view: ComputedRef<View>
  readonly instance: () => string
  readonly collection: () => Collection<unknown>
  readonly registry: () => ReturnType<typeof useCollectionItems>["registry"] | null
  readonly multiple: () => boolean
  readonly modal: () => boolean
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly required: () => boolean
  readonly invalid: () => boolean
  readonly placeholder: () => string | undefined
  readonly keepMounted: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly typeaheadTimeout: () => number
  readonly positioning: () => Parameters<typeof selectPositioning>[0]["positioning"]
  readonly trigger: ShallowRef<HTMLElement | null>
  readonly label: ShallowRef<HTMLElement | null>
  readonly hidden: ShallowRef<HTMLInputElement | null>
  readonly mounted: ShallowRef<Mounted>
  readonly setMounted: (part: "label" | "description" | "list" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The trigger's consumer naming (the list copies `aria-label`). */
  readonly triggerNaming: {
    current: { label?: string | undefined; labelledBy?: string | undefined }
  }
  readonly meta: ShallowRef<LayerMeta | undefined>
  readonly name: () => string | undefined
  readonly form: () => string | undefined
  readonly autoComplete: () => string | undefined
}

const SelectKey: InjectionKey<Ctx> = Symbol("rind-ui.select")
function useSelect(part: string): Ctx {
  const ctx = inject(SelectKey, null)
  if (!ctx) throw new Error(`Select.${part} must be inside Select.Root`)
  return ctx
}

const listFormatter = (locale: string) => {
  const f = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
  return (texts: readonly string[]) => f.format(texts)
}

/** The select's connect: call during render. */
function api(
  ctx: Ctx,
  env: ReturnType<typeof useEnvironment>,
  extra: {
    dir?: "ltr" | "rtl"
    listFocused?: boolean
    modality?: ReturnType<typeof useModality>["value"]
  } = {},
) {
  const view = ctx.view.value
  const m = ctx.mounted.value
  return selectConnect(
    {
      instance: ctx.instance(),
      open: view.matches("open"),
      collection: ctx.collection(),
      selection: selectionOf(view.values.value),
      multiple: ctx.multiple(),
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= ctx.typeaheadTimeout()
      },
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      modal: ctx.modal(),
      disabled: ctx.disabled(),
      readOnly: ctx.readOnly(),
      required: ctx.required(),
      invalid: ctx.invalid(),
      autofilled: view.context.autofilled,
      focusableWhenDisabled: ctx.focusableWhenDisabled(),
      texts: view.context.texts,
      placeholder: ctx.placeholder(),
      listFormat: listFormatter(env.locale.locale()),
      mounted: {
        label: m.label,
        description: m.description,
        list: m.list,
        empty: m.empty,
        itemDescription: (key) => m.descriptions.has(key),
      },
      meta: ctx.meta.value,
      manual: selectPositioning({ positioning: ctx.positioning() }).mode === "manual",
      listFocused: extra.listFocused === true,
      modality: extra.modality ?? "keyboard",
      ...(extra.dir ? { dir: extra.dir } : {}),
    },
    ctx.service.send,
    env,
  )
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "SelectRoot",
  props: {
    /** The base the parts' ids derive from. Default: generated. */
    id: String,
    /** Data items: the value text needs no option mounted (a closed select mounts none). */
    items: Array as PropType<readonly ListboxItemData[]>,
    /** A collection built by the consumer (virtualized lists). */
    collection: Object as PropType<Collection<unknown>>,
    /** Several values (`string[]`) instead of one. */
    multiple: Boolean,
    /** The value (`v-model`): a key or null; with `multiple`, the keys. */
    modelValue: {
      type: [String, Array] as PropType<string | null | readonly string[]>,
      default: undefined,
    },
    defaultValue: {
      type: [String, Array] as PropType<string | null | readonly string[]>,
      default: undefined,
    },
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default true. */
    modal: { type: Boolean, default: true },
    disabled: { type: Boolean, default: undefined },
    /** A disabled trigger stays focusable (`aria-disabled`), and disabled options stay navigable. */
    focusableWhenDisabled: Boolean,
    readOnly: { type: Boolean, default: undefined },
    required: { type: Boolean, default: undefined },
    invalid: { type: Boolean, default: undefined },
    name: String,
    form: String,
    autoComplete: String,
    /** Shown while nothing is selected. */
    placeholder: String,
    /** Default false (a native select does not wrap). */
    loop: Boolean,
    typeaheadTimeout: { type: Number, default: 1000 },
    positioning: Object as PropType<Parameters<typeof selectPositioning>[0]["positioning"]>,
    /** Positioner and content stay mounted (hidden) while closed. */
    keepMounted: Boolean,
  },
  emits: {
    valueChange: (_value: string | null | readonly string[], _details: SelectValueChangeDetails) =>
      true,
    "update:modelValue": (_value: string | null | readonly string[]) => true,
    openChange: (_open: boolean, _details: SelectOpenChangeDetails) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { slots, emit, expose }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const parent = useParentLayer()
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "combobox",
          labelable: true,
          disabled: props.disabled,
          readOnly: props.readOnly,
          required: props.required,
          invalid: props.invalid,
          ...(props.name === undefined ? {} : { name: props.name }),
        },
        enclosing?.value ?? null,
      ),
    )
    const disabled = () => field.value.disabled || fieldsetDisabled.value
    const { collection: registered, registry } = useCollectionItems()
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const collection = () => props.collection ?? data.value ?? registered.value ?? EMPTY
    const s = selectIds(instance())
    const ids = { list: s.list, item: s.item }
    const trigger = shallowRef<HTMLElement | null>(null)
    const label = shallowRef<HTMLElement | null>(null)
    const hidden = shallowRef<HTMLInputElement | null>(null)
    const formInput = hiddenFormInput(
      { input: () => hidden.value, control: () => trigger.value },
      env,
    )
    const machineEnv = { ...env, position: domPositioning(env) }
    // A user change dispatches input + change from the hidden input after it commits.
    let userChange = false
    const { view, send, service } = useMachine(
      selectMachine,
      () => ({
        collection: collection(),
        ids,
        strategy: "roving" as const,
        selectionMode: props.multiple ? ("multiple" as const) : ("single" as const),
        selectionBehavior: "toggle" as const,
        loop: props.loop,
        focusableWhenDisabled: props.focusableWhenDisabled,
        typeaheadTimeout: props.typeaheadTimeout,
        ...(props.modelValue !== undefined ? { value: props.modelValue as SelectValue } : {}),
        defaultValue:
          (props.defaultValue as SelectValue | undefined) ?? (props.multiple ? [] : null),
        onValueChange: (v: SelectValue, details: { event: { type: string } }) => {
          const reason = VALUE_REASON[details.event.type] ?? "select"
          if (reason !== "reset") userChange = true
          emit("valueChange", v as string | null | readonly string[], { reason })
          emit("update:modelValue", v as string | null | readonly string[])
        },
        ...(props.open !== undefined ? { open: props.open } : {}),
        defaultOpen: props.defaultOpen,
        onOpenChange: (o: boolean, d: SelectOpenChangeDetails) => {
          emit("openChange", o, d)
          emit("update:open", o)
        },
        modal: props.modal,
        disabled: disabled(),
        readOnly: field.value.readOnly,
        positioning: props.positioning,
        root: instance(),
        parent: parent(),
        getTrigger: () => trigger.value,
        getLabel: () => label.value,
      }),
      machineEnv,
    )
    expose({
      open: () => send({ type: "OPEN" }),
      close: () => send({ type: "CLOSE" }),
    } satisfies SelectActions)
    const mounted = shallowRef<Mounted>({
      label: false,
      description: false,
      list: false,
      empty: false,
      descriptions: new Set(),
    })
    const meta = shallowRef<LayerMeta | undefined>(undefined)
    onMounted(() =>
      watch(
        () => view.value.matches("open"),
        (open, _, onCleanup) => {
          meta.value = undefined
          if (!open) return
          const node = env.dom.getRootNode()
          const stack = getLayerStack("body" in node ? node : node.ownerDocument)
          const read = () => (meta.value = stack.get(selectLayerId(instance()))?.meta())
          read()
          onCleanup(stack.subscribe(read))
        },
        { immediate: true },
      ),
    )
    const ctx: Ctx = {
      service,
      view,
      instance,
      collection,
      registry: () => (props.collection || data.value ? null : registry),
      multiple: () => props.multiple,
      modal: () => props.modal,
      disabled,
      readOnly: () => field.value.readOnly,
      required: () => field.value.required,
      invalid: () => field.value.invalid,
      placeholder: () => props.placeholder,
      keepMounted: () => props.keepMounted,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
      typeaheadTimeout: () => props.typeaheadTimeout,
      positioning: () => props.positioning,
      trigger,
      label,
      hidden,
      mounted,
      setMounted: (part, on) => {
        if (mounted.value[part] !== on) mounted.value = { ...mounted.value, [part]: on }
      },
      mountDescription: (key, on) => {
        if (mounted.value.descriptions.has(key) === on) return
        const next = new Set(mounted.value.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.value = { ...mounted.value, descriptions: next }
      },
      triggerNaming: { current: {} },
      meta,
      name: () => field.value.name,
      form: () => props.form,
      autoComplete: () => props.autoComplete,
    }
    provide(SelectKey, ctx)
    // The form's view of the value: one key (single) or the constraint plus value carriers.
    const keys = () => {
      const k = selectionOf(view.value.values.value)
      return k === "all" ? [] : [...k]
    }
    const mirror = () => {
      const list = keys()
      return { value: props.multiple ? (list.length > 0 ? "x" : "") : (list[0] ?? "") }
    }
    // After every update: the input shows the value; a user change also fires input + change.
    const sync = () => {
      const dispatch = userChange
      userChange = false
      formInput.sync(mirror(), { dispatch })
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        formInput.track({
          onReset: () => service.send({ type: "FORM.RESET" }),
          current: mirror,
          onNativeInput: (input) => {
            service.send({ type: "FORM.AUTOFILL", text: input.value })
            return true
          },
        }),
      )
      // The value changed without this component updating (the inputs live here).
      watch(() => JSON.stringify(view.value.values.value ?? null), sync, { flush: "post" })
    })
    onUpdated(sync)
    return () => {
      const a = api(ctx, env)
      const list = keys()
      const name = ctx.name()
      return h(Fragment, [
        slots.default?.(),
        h("input", {
          ...normalizeProps(
            a.hiddenInput({ name, form: props.form, autoComplete: props.autoComplete }),
          ),
          ref: refTo(hidden as ShallowRef<Element | null>),
        }),
        ...(props.multiple && name
          ? list.map((k) =>
              h("input", {
                key: k,
                ...normalizeProps(a.hiddenValue(k, { name, form: props.form })),
              }),
            )
          : []),
      ])
    }
  },
})

const Label = defineComponent({
  name: "SelectLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSelect("Label")
    const env = useEnvironment()
    onMounted(() => ctx.setMounted("label", true))
    onBeforeUnmount(() => ctx.setMounted("label", false))
    const el = shallowRef<Element | null>(null)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.label.value = el.value instanceof HTMLElement ? el.value : null
    }
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(api(ctx, env).label()), ref: setEl }, attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

export interface SelectTriggerState {
  readonly open: boolean
  readonly placeholder: boolean
}

const Trigger = defineComponent({
  name: "SelectTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<SelectTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useSelect("Trigger")
    const env = useEnvironment()
    // The modality tracker needs a subscriber while the trigger is mounted.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const binding = useFieldControl()
    const controlId = selectIds(ctx.instance()).trigger
    if (binding) {
      onMounted(() =>
        onBeforeUnmount(
          binding.value.register(
            {
              id: controlId,
              labelable: true,
              focus: (m) => {
                if (ctx.trigger.value) void focusSafely(ctx.trigger.value, env, "programmatic", m)
              },
              validityElement: () => ctx.hidden.value,
              value: () => ctx.service.view().values.value ?? null,
            },
            controlId,
          ),
        ),
      )
    }
    // Each change and each close (a commit) reported to the Field once.
    onMounted(() => {
      watch(
        () => JSON.stringify(ctx.view.value.values.value ?? null),
        (value) =>
          binding?.value.report({
            type: "change",
            value: JSON.parse(value),
            user: true,
            composing: false,
          }),
      )
      watch(
        () => ctx.view.value.matches("open"),
        (open, was) => {
          if (was && !open) binding?.value.report({ type: "commit" })
        },
      )
    })
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") api(ctx, env).pressTrigger(e.modality)
      },
      disabled: () => ctx.disabled(),
      // A label's forwarded click focuses the trigger and never opens the popup.
      labelActivation: "focus",
    })
    const el = shallowRef<Element | null>(null)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.trigger.value = el.value instanceof HTMLElement ? el.value : null
    }
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    // Development: a trigger needs a name (it is never named by its value). Checked once, a
    // frame after mount: the Label registers on mount and the trigger's aria-labelledby follows.
    onMounted(() => {
      if (process.env.NODE_ENV === "production") return
      const frame = env.scheduler.requestAnimationFrame(() => {
        const node = el.value
        if (!node) return
        const named =
          node.hasAttribute("aria-label") ||
          node.hasAttribute("aria-labelledby") ||
          node.closest("label") !== null ||
          ((node as HTMLButtonElement).labels?.length ?? 0) > 0
        if (!named) {
          console.warn(
            `[rind-ui] select #${node.id}: the trigger has no accessible name; render Select.Label or pass aria-label`,
          )
        }
      })
      onBeforeUnmount(() => env.scheduler.cancelAnimationFrame(frame))
    })
    return () => {
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        ...rest
      } = attrs as Record<string, string | undefined>
      ctx.triggerNaming.current = { label, labelledBy }
      const a = api(ctx, env)
      const children = slots.default?.({
        open: ctx.view.value.matches("open"),
        placeholder: a.placeholder,
      })
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(
        a.trigger({
          tag,
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          label,
          labelledBy,
          describedBy,
        }),
      )
      const fieldAria = binding
        ? mergeFieldProps({ role: "combobox", labelable: true }, binding.value)
        : null
      // Space continuing a search must not press the trigger (the trigger's handler acts first).
      const { onKeydown: pressKeyDown, ...pressProps } = press.props as Record<
        string,
        ((e: KeyboardEvent) => void) | undefined
      >
      const merged = mergeProps(
        {
          ...joinHandlers(own, pressProps, {
            onKeydown: (e: KeyboardEvent) => {
              if (!e.defaultPrevented) pressKeyDown?.(e)
            },
            onFocus: () => (focused.value = true),
            onBlur: () => (focused.value = false),
          }),
          ...(fieldAria
            ? {
                "aria-describedby": fieldAria["aria-describedby"] ?? own["aria-describedby"],
                "aria-required": own["aria-required"] ?? fieldAria["aria-required"],
              }
            : {}),
          ref: setEl,
        },
        rest,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

const ValueText = defineComponent({
  name: "SelectValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    /** Render the selected items yourself (an icon next to the text). */
    default?: (selected: readonly string[]) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = useSelect("ValueText")
    const env = useEnvironment()
    return () => {
      const a = api(ctx, env)
      const keys = selectionOf(ctx.view.value.values.value)
      const selected = keys === "all" ? [] : [...keys]
      const text = a.valueTextContent()
      // A new node per value: WebKit re-reads a replaced node, not an updated one (zag#3099).
      const content = slots.default ? slots.default(selected) : h("span", { key: text }, text)
      return renderPart(
        "span",
        mergeProps(normalizeProps(a.valueText()), attrs),
        content,
        props.asChild,
      )
    }
  },
})

/** A part with no state of its own. */
function simplePart(
  name: string,
  tag: string,
  pick: (a: ReturnType<typeof api>) => Record<string, unknown>,
  mount?: "description",
) {
  return defineComponent({
    name: `Select${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useSelect(name)
      const env = useEnvironment()
      if (mount) {
        onMounted(() => ctx.setMounted(mount, true))
        onBeforeUnmount(() => ctx.setMounted(mount, false))
      }
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(pick(api(ctx, env)) as never), attrs),
          slots.default?.(),
          props.asChild,
        )
    },
  })
}

const Indicator = simplePart("Indicator", "span", (a) => a.indicator())
const Description = simplePart("Description", "div", (a) => a.description(), "description")

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx) {
  const dir = shallowRef<"ltr" | "rtl" | undefined>(undefined)
  onMounted(() =>
    watch(
      () => ctx.view.value.matches("open"),
      (open) => {
        if (!open) return
        const found = ctx.trigger.value?.closest("[dir]")?.getAttribute("dir")
        dir.value = found === "rtl" ? "rtl" : "ltr"
      },
      { immediate: true, flush: "post" },
    ),
  )
  return dir
}

const Positioner = defineComponent({
  name: "SelectPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSelect("Positioner")
    const env = useEnvironment()
    const dir = useTriggerDir(ctx)
    const el = shallowRef<Element | null>(null)
    const open = () => ctx.view.value.matches("open")
    const presence = usePresence(open, el, { keepMounted: ctx.keepMounted, subtree: () => true })
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(api(ctx, env, dir.value ? { dir: dir.value } : {}).positioner()),
          hidden: !open() && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Content = defineComponent({
  name: "SelectContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSelect("Content")
    const env = useEnvironment()
    provideLayer(
      () => selectLayerId(ctx.instance()),
      () => "listbox",
    )
    const el = shallowRef<Element | null>(null)
    const open = () => ctx.view.value.matches("open")
    const presence = usePresence(open, el, { keepMounted: ctx.keepMounted })
    // The scroll lock writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const exiting = !open() && presence.state === "exiting"
      const merged = mergeProps(
        {
          ...normalizeProps(api(ctx, env).content()),
          hidden: !open() && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
const Portal = defineComponent({
  name: "SelectPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useSelect("Portal")
    const logicalParent = () => ctx.trigger.value
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

/** The listbox parts, bound to this select (the list named as the trigger says). */
const HostKey: InjectionKey<ListboxHost> = Symbol("rind-ui.select-listbox")

/** Provides the listbox host to the parts below (the List and its items). */
const ListHost = defineComponent({
  name: "SelectListHost",
  setup(_, { slots }) {
    const ctx = useSelect("List")
    const env = useEnvironment()
    // A Field's label names the list when the select renders no label of its own.
    const fieldLabel = useFieldBindingPeek()
    const listFocused = shallowRef(false)
    const modality = useModality(env.modality, () => listFocused.value)
    onMounted(() => ctx.setMounted("list", true))
    onBeforeUnmount(() => ctx.setMounted("list", false))
    const parts = computed(() => {
      const a = api(ctx, env, { listFocused: listFocused.value, modality: modality.value })
      return {
        ...a.listbox,
        list: () => ({
          ...a.list({
            ...ctx.triggerNaming.current,
            labelledBy: ctx.triggerNaming.current.labelledBy ?? fieldLabel?.value.ids.label,
          }),
          onFocus: () => (listFocused.value = true),
          onBlur: () => (listFocused.value = false),
        }),
      }
    })
    provide(HostKey, {
      name: "Select",
      parts: () => parts.value as never,
      collection: ctx.collection,
      registry: ctx.registry(),
      mount: (p, on) => ctx.setMounted(p, on),
      mountDescription: ctx.mountDescription,
      requestLoadMore: () => {},
    })
    return () => slots["default"]?.()
  },
})

const listParts = createListboxParts(HostKey, "Select")

/** The list: it registers itself (aria-controls exists only while it is mounted). */
const List = defineComponent({
  name: "SelectList",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(ListHost, null, () => h(listParts.List, attrs, slots))
  },
})

const {
  Item,
  ItemText,
  ItemDescription,
  ItemIndicator,
  Section,
  Separator,
  Empty,
  LoadMore,
  Items,
} = listParts

/** The parts, by name: `select.parts.ts` re-exports them as the `Select` namespace. */
export {
  Content,
  Description,
  Empty,
  Indicator,
  Item,
  ItemDescription,
  ItemIndicator,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Portal,
  Positioner,
  Root,
  Section,
  Separator,
  Trigger,
  ValueText,
}
