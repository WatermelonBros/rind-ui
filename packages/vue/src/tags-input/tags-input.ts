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
  computed,
  defineComponent,
  Fragment,
  getCurrentInstance,
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
import { createPopupParts } from "../combobox/popup-parts"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
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

type Api = ReturnType<typeof tagsInputConnect>

interface Host {
  readonly api: () => Api
  readonly chips: () => readonly ChipData[]
  readonly editingKey: () => string | null
  readonly setDisabled: (key: string, on: boolean) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly constraint: ShallowRef<HTMLInputElement | null>
  readonly pending: { current: boolean }
  readonly tags: () => readonly string[]
  readonly reset: () => void
  readonly open: () => boolean
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  readonly topLayer: () => boolean
  /** The edit inputs re-render synchronously on a commit (`commitSync`). */
  readonly renderers: Set<() => void>
}

const HostKey: InjectionKey<Host> = Symbol("rind-ui.tags-input")
const ListKey: InjectionKey<ListboxHost> = Symbol("rind-ui.tags-input-listbox")
function useHost(part: string): Host {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`TagsInput.${part} must be inside TagsInput.Root`)
  return host
}

type Slots = SlotsType<{ default?: () => VNodeChild }>
/** A boolean whose absence means the machine's default. */
const flag = { type: Boolean, default: undefined }

const Root = defineComponent({
  name: "TagsInputRoot",
  props: {
    /** The base of the generated part ids. Default: a generated id. */
    id: String,
    /** The tags (`v-model`). */
    modelValue: { type: Array as PropType<readonly string[]>, default: undefined },
    defaultValue: Array as PropType<readonly string[]>,
    /** The draft (`v-model:inputValue`). */
    inputValue: { type: String, default: undefined },
    defaultInputValue: String,
    /** Default ",". Strings match literally. */
    delimiter: [String, Array, Object] as PropType<Delimiters>,
    /** Default: the delimiters plus newline, tab and ";". */
    pasteDelimiter: [String, Array, Object] as PropType<Delimiters>,
    addOnPaste: flag,
    normalize: Function as PropType<(text: string) => string>,
    allowDuplicates: flag,
    compare: Function as PropType<(a: string, b: string) => boolean>,
    max: Number,
    validate: Function as PropType<(text: string, value: readonly string[]) => true | string>,
    blurBehavior: String as PropType<"keep" | "add" | "clear">,
    editable: flag,
    removeOnBackspace: flag,
    disabled: flag,
    readOnly: flag,
    invalid: flag,
    required: flag,
    name: String,
    inputName: String,
    /** The id of the form the submitted tags (and the named text input) belong to. */
    form: String,
    messages: Object as PropType<Partial<TagsInputMessages>>,
    /** Suggestions: the input becomes a combobox; choosing one creates a tag from its key. */
    items: Array as PropType<readonly TagsInputItemData[]>,
    /** Suggestions built by the consumer (virtualized or async lists). */
    collection: Object as PropType<Collection<unknown>>,
    /** The suggestion matcher; `null` lists them unfiltered (consumer or server filtering). */
    filter: { type: [Function, null] as PropType<ComboboxFilter>, default: undefined },
    /** The draft the given suggestions answer (async): another draft's are stale. */
    itemsQuery: String,
    loading: String as PropType<LoadingStatus>,
    /** The suggestions' LoadMore sentinel came into view. */
    onLoadMore: Function as PropType<() => void>,
    /** Choosing a suggestion closes the popup (default false). */
    closeOnSelect: flag,
    /** With suggestions, typed text may become a tag (default true). */
    allowCustom: flag,
    autoHighlight: flag,
    /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
    typingPause: Number,
    positioning: Object as PropType<PositioningProps>,
    keepMounted: Boolean,
  },
  emits: {
    valueChange: (_value: readonly string[], _details: TagsInputChangeDetails) => true,
    "update:modelValue": (_value: readonly string[]) => true,
    inputValueChange: (_text: string, _details: TagsInputChangeDetails) => true,
    "update:inputValue": (_text: string) => true,
    refuse: (_refusal: TagRefusal) => true,
  },
  slots: Object as Slots,
  setup(props, { slots, emit }) {
    const base = useEnvironment(announcerCapability, layoutCapability)
    const env = { ...base, position: domPositioning(base) }
    const instance = useRootId(() => props.id)
    const binding = useFieldControl()
    const fieldsetDisabled = useFieldsetDisabled()
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "textbox",
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
    const ids = tagsInputIds(instance())
    const locale = () => env.locale.locale()
    const messages = computed(() => ({ ...tagsInputMessages, ...props.messages }))
    const pending = { current: false }
    const constraint = shallowRef<HTMLInputElement | null>(null)
    const disabledKeys = shallowRef<ReadonlySet<string>>(new Set())
    const mounted = shallowRef<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    // Suggestions: every option, and the listed ones (the draft's, without the chosen tags).
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const full = () => props.collection ?? data.value
    // The draft and the tags the results answer: mirrored from the service (the props read
    // them, and the view reads the props).
    const query = shallowRef("")
    const chosen = shallowRef<readonly string[]>([])
    const openNow = shallowRef(false)
    const live = computed(() => {
      const f = full()
      return f
        ? tagSuggestions(
            patternResults(f, query.value, props.filter, locale()),
            chosen.value,
            props.allowDuplicates === true,
          )
        : NO_ITEMS
    })
    // While closing, the listed options are those of the moment it started closing.
    let frozen = live.value
    const results = computed(() => {
      const l = live.value
      if (openNow.value) frozen = l
      return openNow.value || !full() ? l : frozen
    })
    const machineProps = () => ({
      ...(props.modelValue !== undefined ? { value: props.modelValue } : {}),
      defaultValue: props.defaultValue ?? [],
      ...(props.inputValue !== undefined ? { inputValue: props.inputValue } : {}),
      defaultInputValue: props.defaultInputValue,
      delimiter: props.delimiter,
      pasteDelimiter: props.pasteDelimiter,
      addOnPaste: props.addOnPaste,
      normalize: props.normalize,
      allowDuplicates: props.allowDuplicates,
      compare: props.compare,
      max: props.max,
      validate: props.validate,
      onRefuse: (r: TagRefusal) => emit("refuse", r),
      blurBehavior: props.blurBehavior,
      editable: props.editable,
      removeOnBackspace: props.removeOnBackspace,
      disabledKeys: disabledKeys.value,
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
      locale: locale(),
      messages: messages.value,
      items: full() ?? undefined,
      collection: results.value,
      ids,
      strategy: "active-descendant" as const,
      root: instance(),
      closeOnSelect: props.closeOnSelect,
      allowCustom: props.allowCustom,
      autoHighlight: props.autoHighlight,
      typingPause: props.typingPause,
      positioning: props.positioning,
      loading: props.loading,
      onLoadMore: props.onLoadMore,
      stale: isStale({ itemsQuery: props.itemsQuery, query: query.value }),
      onValueChange: (v: readonly string[], d: { event: { type: string } }) => {
        pending.current = true
        binding?.value.report({
          type: "change",
          value: v,
          user: userTagsChange(d.event.type),
          composing: false,
        })
        // A value changed by a text change is always a delimiter split.
        emit("valueChange", v, { reason: reasonOf(d.event.type, true) })
        emit("update:modelValue", v)
      },
      onInputValueChange: (t: string, d: { event: { type: string } }) => {
        emit("inputValueChange", t, { reason: reasonOf(d.event.type, false) })
        emit("update:inputValue", t)
      },
    })
    const { view, service } = useMachine(tagsInputMachine, machineProps as never, env)
    const mirror = () => {
      const v = service.view()
      openNow.value = v.state === "suggesting"
      query.value = (v.values.inputValue as string | undefined) ?? ""
      chosen.value = (v.values.value as readonly string[] | undefined) ?? []
    }
    mirror()
    onMounted(() => {
      mirror()
      onBeforeUnmount(service.subscribe(mirror))
    })
    const present = shallowRef(false)
    // Known after mount: the server render and hydration never carry `popover`.
    const topLayer = shallowRef(false)
    onMounted(() => {
      topLayer.value = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
    })
    const open = () => view.value.state === "suggesting"
    const exposure = () => ({
      open: open(),
      results: results.value,
      query: query.value,
      itemsQuery: props.itemsQuery,
      loading: props.loading,
    })
    const tags = () => view.value.values.value as readonly string[]
    const chips = computed(() =>
      tagChips(
        {
          ...(machineProps() as object),
          disabled: field.value.disabled,
          readOnly: field.value.readOnly,
        },
        tags(),
      ),
    )
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
              validityElement: () => constraint.value,
              value: () => service.view().values.value,
            },
            ids.input,
          ),
        ),
      )
    }
    const formInput = hiddenFormInput(
      {
        input: () => constraint.value,
        // Sound: the Input part renders an <input> with this id.
        control: () => env.dom.getById(ids.input) as HTMLElement | null,
      },
      env,
    )
    const modality = useModality(env.modality, () => view.value.context.focused)
    const renderers = new Set<() => void>()
    const api = computed(() => {
      const v = view.value
      const f = field.value
      const m = mounted.value
      const t = tags()
      const normalize = props.normalize ?? ((s: string) => s.trim())
      return tagsInputConnect(
        {
          instance: instance(),
          state: v.state as "idle" | "typing" | "suggesting" | "editing",
          context: v.context,
          tags: t,
          chips: chips.value,
          inputValue: v.values.inputValue as string,
          disabled: f.disabled,
          readOnly: f.readOnly,
          invalid: f.invalid,
          required: f.required,
          atMax: props.max !== undefined && t.length >= props.max,
          draftNotEmpty: normalize(v.values.inputValue as string) !== "",
          delimiter: props.delimiter ?? ",",
          pasteDelimiter: props.pasteDelimiter,
          addOnPaste: props.addOnPaste !== false,
          modality: modality.value,
          dir: env.locale.dir(),
          locale: locale(),
          messages: messages.value,
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          suggestions: full() != null,
          results: results.value,
          exposed: isExposed(exposure()),
          empty: isEmptyState(exposure()),
          present: present.value || open(),
          loading: props.loading,
          topLayer: topLayer.value,
          name: f.name,
          inputName: props.inputName,
          form: props.form,
          field: f,
          fieldData: binding?.value.data,
          // Vue renders on a later tick: the edit inputs re-render now (they exist right after).
          commitSync: (fn) => {
            fn()
            for (const render of renderers) render()
          },
          send: service.send,
        },
        env,
      )
    })
    let loadedFor: Collection<unknown> | null = null
    provide(HostKey, {
      api: () => api.value,
      chips: () => chips.value,
      editingKey: () => (view.value.state === "editing" ? view.value.context.editingKey : null),
      setDisabled: (key, on) => {
        if (disabledKeys.value.has(key) === on) return
        const next = new Set(disabledKeys.value)
        if (on) next.add(key)
        else next.delete(key)
        disabledKeys.value = next
      },
      formInput,
      constraint,
      pending,
      tags,
      reset: () => service.send({ type: "FORM.RESET" }),
      open,
      keepMounted: () => props.keepMounted,
      setPresent: (p) => (present.value = p),
      topLayer: () => topLayer.value,
      renderers,
    })
    provide(ListKey, {
      name: "TagsInput",
      // Sound: the tags-input api has every listbox part the shared parts call.
      parts: () =>
        ({ ...api.value, isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results.value,
      registry: null,
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
        loadedFor = full() ?? null
        props.onLoadMore?.()
      },
    })
    return () => slots.default?.()
  },
})

/** A part with no state of its own. */
function simplePart(name: string, tag: string, pick: (a: Api) => Record<string, unknown>) {
  return defineComponent({
    name: `TagsInput${name}`,
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
  name: "TagsInputLabel",
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
  name: "TagsInputControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Control")
    // The carriers reflect every change; a user change dispatches input and change.
    const sync = () => {
      host.formInput.sync({ values: host.tags() }, { dispatch: host.pending.current })
      host.pending.current = false
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        host.formInput.track({ onReset: host.reset, current: () => ({ values: host.tags() }) }),
      )
      // The value changed without this part updating.
      watch(() => host.tags().join("\u0000"), sync, { flush: "post" })
    })
    onUpdated(sync)
    return () => {
      const api = host.api()
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.control()), attrs),
        h(Fragment, [
          slots.default?.(),
          h("span", normalizeProps(api.chipsSummary()), api.summaryText),
          h("input", {
            ...normalizeProps(api.hiddenInput()),
            ref: refTo(host.constraint as ShallowRef<Element | null>),
          }),
          // Positional: duplicates are allowed.
          ...api.carriers().map((p, i) => h("input", { key: i, ...normalizeProps(p) })),
        ]),
        props.asChild,
      )
    }
  },
})

const Input = defineComponent({
  name: "TagsInputInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const host = useHost("Input")
    return () =>
      renderPart(
        "input",
        mergeProps(normalizeProps(host.api().input()), attrs),
        undefined,
        props.asChild,
      )
  },
})

const ClearTrigger = simplePart("ClearTrigger", "button", (a) => a.clearTrigger())

const ChipKey: InjectionKey<() => ChipData> = Symbol("rind-ui.tags-input-chip")
const useChip = (part: string) => {
  const chip = inject(ChipKey, null)
  if (chip === null) throw new Error(`TagsInput.${part} must be inside TagsInput.Chips`)
  return chip
}

/** Provides one chip to the parts inside it. */
const ChipScope = defineComponent({
  name: "TagsInputChipScope",
  props: { chip: { type: Object as PropType<ChipData>, required: true } },
  setup(props, { slots }) {
    provide(ChipKey, () => props.chip)
    return () => slots["default"]?.()
  },
})

const Chip = defineComponent({
  name: "TagsInputChip",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** Locks this tag: it cannot be edited or removed, and clearing keeps it. */
    disabled: Boolean,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Chip")
    const chip = useChip("Chip")
    watch(
      [() => chip().key, () => props.disabled],
      ([key, disabled], _, onCleanup) => {
        host.setDisabled(key, disabled)
        onCleanup(() => host.setDisabled(key, false))
      },
      { immediate: true },
    )
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.api().chip(chip().key)), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ChipText = defineComponent({
  name: "TagsInputChipText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ChipText")
    const chip = useChip("ChipText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.api().chipText(chip().key)), attrs),
        slots.default?.() ?? chip().text,
        props.asChild,
      )
  },
})

/** The edit input: rendered only while its chip is edited. */
const ChipInput = defineComponent({
  name: "TagsInputChipInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const host = useHost("ChipInput")
    const chip = useChip("ChipInput")
    // Sound: setup runs inside a component instance.
    const self = getCurrentInstance() as NonNullable<ReturnType<typeof getCurrentInstance>>
    const render = () => self.update()
    host.renderers.add(render)
    onBeforeUnmount(() => host.renderers.delete(render))
    return () =>
      host.editingKey() !== chip().key
        ? null
        : renderPart(
            "input",
            mergeProps(normalizeProps(host.api().chipInput(chip().key)), attrs),
            undefined,
            props.asChild,
          )
  },
})

const ChipRemove = defineComponent({
  name: "TagsInputChipRemove",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ChipRemove")
    const chip = useChip("ChipRemove")
    return () =>
      renderPart(
        "button",
        mergeProps(normalizeProps(host.api().chipRemove(chip().key)), attrs),
        slots.default?.() ?? h("span", { "aria-hidden": "true" }, "×"),
        props.asChild,
      )
  },
})

/** The chips toolbar: one Chip per tag, before the Input. */
const Chips = defineComponent({
  name: "TagsInputChips",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    /** Renders one chip; default: ChipText, ChipInput while edited, and ChipRemove. */
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
            h(ChipScope, { key: chip.key, chip }, () =>
              slots.default
                ? slots.default(chip)
                : h(Chip, null, () => [h(ChipText), h(ChipInput), h(ChipRemove)]),
            ),
          ),
        props.asChild,
      )
  },
})

const { Positioner, Popup } = createPopupParts(
  (part) => ({ ...useHost(part), inline: false }),
  "TagsInput",
)
const {
  List,
  Item,
  ItemText,
  Section: Group,
  Separator,
  Empty,
  Items,
} = createListboxParts(ListKey, "TagsInput")

/** The parts, by name: `tags-input.parts.ts` re-exports them as the `TagsInput` namespace. */
export {
  Chip,
  ChipInput,
  ChipRemove,
  Chips,
  ChipText,
  ClearTrigger,
  Control,
  Empty,
  Group,
  Input,
  Item,
  Items,
  ItemText,
  Label,
  List,
  Popup,
  Positioner,
  Root,
  Separator,
}
