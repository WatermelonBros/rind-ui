import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  focusSafely,
  hiddenFormInput,
  type ItemRegistry,
  implicitSubmit,
  isImeKey,
  labelInteraction,
  layoutCapability,
  mergeFieldProps,
  type RadioGroupEvent,
  type RadioNaming,
  radioGroupConnect,
  radioGroupIds,
  radioGroupMachine,
  radioPartName,
  toKey,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { useCompositeHost, useHostItem } from "../composite-host"
import { changeEmitter } from "../emit-change"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly api: (pendingStop?: string | null) => ReturnType<typeof radioGroupConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly parts: PartRegistry<GroupPart>
  readonly ids: () => ReturnType<typeof radioGroupIds>
  readonly value: () => string | null
  readonly disabled: () => boolean
  readonly inField: boolean
  readonly invalid: () => boolean
  /** A user change waiting for its commit: that item's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly focusableWhenDisabled: () => boolean
  /** Hosted by a Toolbar: Enter checks (APG toolbar) and never submits. */
  readonly hosted: boolean
  readonly stop: ReturnType<typeof declaredStop>
}
const GroupKey: InjectionKey<Ctx> = Symbol("rind-ui.radio-group")
/**
 * Internal (not exported from the package): set by a component that renders a Radio Group as
 * its part (Color Picker's swatch group): the host's scope and part names.
 */
export const RadioGroupNamingKey: InjectionKey<RadioNaming | null> = Symbol("rind-ui.radio-naming")
function useGroup(part: string): Ctx {
  const ctx = inject(GroupKey, null)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: () => CollectionKey
  readonly disabled: () => boolean
  readonly controlTag: () => string
  readonly setControlTag: (tag: string) => void
  readonly labelRendered: () => boolean
  readonly setLabelRendered: (on: boolean) => void
  readonly descriptionRendered: () => boolean
  readonly setDescriptionRendered: (on: boolean) => void
  readonly inputEl: { value: HTMLInputElement | null }
  readonly controlEl: { value: Element | null }
  /** This item's view of the server tab stop (read once, in document order). */
  readonly pendingStop: string | null
}
const ItemKey: InjectionKey<ItemCtx> = Symbol("rind-ui.radio-item")
function useItem(part: string): ItemCtx {
  const ctx = inject(ItemKey, null)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Item`)
  return ctx
}

export interface RadioGroupState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface RadioItemState {
  readonly checked: boolean
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "RadioGroupRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`). */
    modelValue: { type: [String, null] as PropType<string | null>, default: undefined },
    defaultValue: { type: [String, null] as PropType<string | null>, default: undefined },
    /** Only `aria-orientation` and `data-orientation`: every arrow key moves. */
    orientation: { type: String as PropType<"vertical" | "horizontal">, default: "vertical" },
    /** Disables every radio. */
    disabled: Boolean,
    /** A disabled group stays discoverable: the root is one tab stop. */
    focusableWhenDisabled: { type: Boolean, default: undefined },
    /** Navigable, never changes. */
    readonly: Boolean,
    /** Valid with one radio checked. */
    required: Boolean,
    /** Marks the group invalid; shows the ErrorMessage. */
    invalid: Boolean,
    /** Default: derived from the root id (two groups never form one browser group). */
    name: String,
    /** The id of the form the hidden inputs belong to. */
    form: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string | null, _details: ChangeDetails<RadioGroupEvent>) => true,
    "update:modelValue": (_value: string | null) => true,
  },
  slots: Object as SlotsType<{ default?: (state: RadioGroupState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const naming = inject(RadioGroupNamingKey, null)
    const ids = computed(() =>
      naming ? radioGroupIds(instance(), naming) : radioGroupIds(instance()),
    )
    // The parts the effects below look up, under a host's names when the group is its part.
    const hiddenPart = naming ? radioPartName(naming, "hidden-input") : "hidden-input"
    const controlPart = naming?.control ?? "item-control"
    const binding = useFieldControl()
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
    const host = useCompositeHost()
    const focusableWhenDisabled = () =>
      props.focusableWhenDisabled ?? host?.focusableWhenDisabled ?? false
    const ariaLabel = () => attrs["aria-label"] as string | undefined
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "radiogroup",
          labelable: false,
          disabled:
            props.disabled || fieldsetContext.value || fieldsetDom.value || host?.disabled === true,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
          ariaLabel: ariaLabel(),
        },
        binding?.value ?? null,
      ),
    )
    const { collection: registered, registry } = useCollectionItems()
    const collection = () => registered.value ?? EMPTY
    const pending = { current: null as string | null }
    // The reason of the latest accepted change, for the Field: only a user's clears its
    // external (server) errors (base-ui#1745); a parent's value or a reset does not.
    let lastReason: string | null = null
    const emitChange = changeEmitter<string | null, RadioGroupEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(
      radioGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids.value,
        loop: true,
        selectionMode: "single" as const,
        focusableWhenDisabled: focusableWhenDisabled(),
        value: props.modelValue,
        defaultValue: props.defaultValue,
        // A user change (an arrow or a press) is dispatched on that item's input after commit.
        onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
          lastReason = details.reason
          if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
          emitChange(next, details)
        },
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
      }),
      env,
    )
    const current = () => view.value.values.value ?? null
    // The Label is expected unless something else names the group: the server HTML then
    // already labels the root (base-ui#5597).
    const parts = usePartRegistry<GroupPart>({
      scope: "radio-group",
      root: instance(),
      ...(ariaLabel() === undefined && binding === null ? { expected: ["label"] as const } : {}),
    })
    const rendered = {
      label: useRenderedId(parts, "label"),
      description: useRenderedId(parts, "description"),
      errorMessage: useRenderedId(parts, "error-message"),
    }
    const api = (pendingStop: string | null = null) =>
      radioGroupConnect(
        {
          instance: instance(),
          ...(naming ? { naming } : {}),
          collection: collection(),
          value: current(),
          highlightedKey: view.value.context.highlightedKey,
          highlightSource: view.value.context.highlightSource,
          pending: registered.value === null,
          pendingStop,
          orientation: props.orientation,
          disabled: field.value.disabled,
          focusableWhenDisabled: focusableWhenDisabled(),
          readOnly: field.value.readOnly,
          required: field.value.required || field.value["aria-required"] === "true",
          invalid: field.value.invalid,
          name: field.value.name,
          form: props.form,
          rendered: {
            label: rendered.label.value,
            description: rendered.description.value,
            errorMessage: rendered.errorMessage.value,
          },
          ...(binding ? { field: binding.value.ids } : {}),
          ariaLabel: ariaLabel(),
          hosted: host !== null,
        },
        send,
        env,
      )
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      const node = el.value
      if (!node) return
      const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
      fieldsetDom.value = w.disabled
      // A form reset is answered once, by the group (every item's input re-syncs).
      const doc = node.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const input = node.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`)
        if (input && e.target === input.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      onBeforeUnmount(() => {
        w.stop()
        doc.removeEventListener("reset", onReset)
      })
      // field-control: the group registers once as one (non-labelable) control.
      if (binding) {
        const radios = () =>
          Array.from(
            el.value?.querySelectorAll<HTMLElement>(
              `[data-part="${controlPart}"][data-instance="${instance()}"]`,
            ) ?? [],
          )
        const off = binding.value.register(
          {
            id: instance(),
            labelable: false,
            // The checked radio, else the first enabled one (react-spectrum#3883).
            focus: (modality) => {
              const all = radios()
              const target =
                all.find((r) => r.getAttribute("aria-checked") === "true") ??
                all.find(
                  (r) => r.getAttribute("aria-disabled") !== "true" && !r.hasAttribute("disabled"),
                )
              if (target) void focusSafely(target, env, "programmatic", modality)
            },
            validityElement: () =>
              el.value?.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`) ?? null,
            value: () => current(),
          },
          instance(),
        )
        onBeforeUnmount(off)
      }
      let reported = current()
      watch(current, (now) => {
        if (reported === now) return
        reported = now
        const user = lastReason === "NAVIGATE" || lastReason === "PRESS"
        lastReason = null
        binding?.value.report({ type: "change", value: now, user, composing: false })
        binding?.value.report({ type: "commit" })
      })
    })
    // After the items' updates: a proposal the parent refused never dispatches later.
    const settle = () => {
      if (pending.current !== null && pending.current !== current()) pending.current = null
      // Development: a radiogroup needs a name. Checked after the re-render a Label's or a
      // Field's registration causes, not on the first mount.
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      queueMicrotask(() => {
        if (!node.isConnected) return
        if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
          console.warn(
            `[rind-ui] radio-group: #${node.id} has no accessible name; render RadioGroup.Label or pass aria-label`,
          )
        }
      })
    }
    onMounted(settle)
    onUpdated(settle)
    provide(GroupKey, {
      api,
      send,
      registry,
      parts,
      ids: () => ids.value,
      value: current,
      disabled: () => field.value.disabled,
      inField: binding !== null,
      invalid: () => field.value.invalid,
      pending,
      focusableWhenDisabled,
      hosted: host !== null,
      stop: declaredStop(),
    })
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps({ ...api().root(), ...binding?.value.data }),
          ...(ariaLabel() === undefined ? {} : { "aria-label": ariaLabel() }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart(
        "div",
        merged,
        slots.default?.({ value: current(), disabled: field.value.disabled }),
        props.asChild,
      )
    }
  },
})

/** Not a <label>: a radiogroup is not labelable. */
const Label = defineComponent({
  name: "RadioGroupLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("Label")
    useRegisterPart(ctx.parts, "label", () => ctx.ids().label)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().label()), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const Description = defineComponent({
  name: "RadioGroupDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("Description")
    useRegisterPart(ctx.parts, "description", () => ctx.ids().description)
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(ctx.api().description()), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const ErrorMessage = defineComponent({
  name: "RadioGroupErrorMessage",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("ErrorMessage")
    // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
    const shown = () => !ctx.inField && ctx.invalid()
    useRegisterPart(ctx.parts, "error-message", () =>
      shown() ? ctx.ids().errorMessage : undefined,
    )
    return () =>
      shown()
        ? renderPart(
            "p",
            mergeProps(normalizeProps(ctx.api().errorMessage()), attrs),
            slots["default"]?.(),
            props.asChild,
          )
        : null
  },
})

type ItemSlots = SlotsType<{ default?: (state: RadioItemState) => VNodeChild }>

const Item = defineComponent({
  name: "RadioGroupItem",
  inheritAttrs: false,
  props: {
    /** The item's value: what the group's value and the form submit. */
    value: { type: String, required: true },
    /** Disables this radio only. */
    disabled: Boolean,
    /** The text for the collection (defaults to the item's text content). */
    textValue: String,
    ...asChildProp,
  },
  slots: Object as ItemSlots,
  setup(props, { attrs, slots }) {
    const ctx = useGroup("Item")
    const env = useEnvironment()
    const key = () => toKey(props.value)
    const el = shallowRef<Element | null>(null)
    useRegisterItem(
      ctx.registry,
      () => ({ key: props.value, textValue: props.textValue, disabled: props.disabled }),
      el,
    )
    const controlTag = shallowRef("button")
    const labelRendered = shallowRef(false)
    const descriptionRendered = shallowRef(false)
    const inputEl = shallowRef<HTMLInputElement | null>(null)
    const controlEl = shallowRef<Element | null>(null)
    const checked = () => ctx.value() === key()
    const formInput = hiddenFormInput(
      { input: () => inputEl.value, control: () => controlEl.value as HTMLElement | null },
      env,
    )
    // After every update: the input mirrors the value; the newly checked one, after a user
    // change, dispatches input + change (programmatic changes stay silent).
    const sync = () => {
      const dispatch = checked() && ctx.pending.current === key()
      formInput.sync({ checked: checked() }, { dispatch })
      if (dispatch) ctx.pending.current = null
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        formInput.track({
          onReset: () => {},
          current: () => ({ checked: checked() }),
          // The group answers the reset once; each input only re-syncs.
          resetsWithForm: false,
        }),
      )
    })
    onUpdated(sync)
    provide(ItemKey, {
      key,
      disabled: () => props.disabled,
      controlTag: () => controlTag.value,
      setControlTag: (tag) => (controlTag.value = tag),
      labelRendered: () => labelRendered.value,
      setLabelRendered: (on) => (labelRendered.value = on),
      descriptionRendered: () => descriptionRendered.value,
      setDescriptionRendered: (on) => (descriptionRendered.value = on),
      inputEl,
      controlEl,
      pendingStop: ctx.stop(
        props.value,
        ctx.disabled() || props.disabled,
        ctx.value() === null ? [] : [ctx.value() as string],
      ),
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(ctx.api().item(key(), { disabled: props.disabled })),
            ref: refTo(el),
          },
          attrs,
        ),
        [
          slots.default?.({ checked: checked(), disabled: ctx.disabled() || props.disabled }),
          // A sibling of the control, never inside it (reka-ui#1597).
          renderPart(
            "input",
            {
              ...normalizeProps(ctx.api().hiddenInput(key(), { disabled: props.disabled })),
              ref: refTo(inputEl),
            },
            undefined,
          ),
        ],
        props.asChild,
      )
  },
})

const ItemControl = defineComponent({
  name: "RadioGroupItemControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as ItemSlots,
  setup(props, { attrs, slots }) {
    const ctx = useGroup("ItemControl")
    const item = useItem("ItemControl")
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const el = shallowRef<Element | null>(null)
    // Stable: a new ref function on every render would detach and reattach the element.
    const setEl = (node: unknown) => {
      refTo(el)(node)
      item.controlEl.value = el.value
    }
    const measure = () => item.setControlTag(el.value?.tagName.toLowerCase() ?? "button")
    onMounted(measure)
    onUpdated(measure)
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const disabled = () => ctx.disabled() || item.disabled()
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "PRESS", key: item.key(), modality: e.modality })
      },
      disabled,
    })
    const hover = useHover({ env, send: () => {}, disabled })
    // Hosted: the radio is also one of the host's controls (navigation and tab stop).
    const host = useCompositeHost()
    const hostKey = () => ctx.ids().item(item.key())
    useHostItem(
      host,
      // The toolbar has no typeahead: the value is enough to name the registration.
      () => ({
        id: hostKey(),
        skip: disabled() && !ctx.focusableWhenDisabled(),
        textValue: item.key(),
      }),
      el,
    )
    return () => {
      const tag = item.controlTag()
      const labelable = tag === "button" || tag === "input"
      const hostProps = host
        ? normalizeProps(
            host.itemProps({
              id: hostKey(),
              disabled: disabled(),
              first: host.claimFirst(hostKey()),
            }),
          )
        : {}
      const own = normalizeProps(
        ctx.api(item.pendingStop).itemControl(item.key(), {
          tag,
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
          itemDisabled: item.disabled(),
          labelable,
          labelRendered: item.labelRendered(),
          descriptionRendered: item.descriptionRendered(),
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(
            own,
            hostProps,
            {
              // Enter submits the form (implicit submission) and never checks; hosted by a
              // toolbar, Enter checks like Space (APG toolbar example) and never submits.
              onKeydown: (e: KeyboardEvent) => {
                if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
                if (!ctx.hosted) {
                  implicitSubmit(item.inputEl.value?.form ?? null)
                  return
                }
                e.preventDefault()
                if (!disabled() && !e.repeat)
                  ctx.send({ type: "PRESS", key: item.key(), modality: "keyboard" })
              },
            },
            press.props,
            hover.props,
            { onFocusin: () => (focused.value = true), onFocusout: () => (focused.value = false) },
          ),
          ref: setEl,
        },
        attrs,
      )
      return renderPart(
        "button",
        merged,
        slots.default?.({ checked: ctx.value() === item.key(), disabled: disabled() }),
        props.asChild,
      )
    }
  },
})

/** Mounted only while checked. */
const ItemIndicator = defineComponent({
  name: "RadioGroupItemIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as ItemSlots,
  setup(props, { attrs, slots }) {
    const ctx = useGroup("ItemIndicator")
    const item = useItem("ItemIndicator")
    return () =>
      ctx.value() === item.key()
        ? renderPart(
            "span",
            mergeProps(
              normalizeProps(ctx.api().itemIndicator(item.key(), { disabled: item.disabled() })),
              attrs,
            ),
            slots.default?.({ checked: true, disabled: item.disabled() }),
            props.asChild,
          )
        : null
  },
})

function itemText(name: "ItemLabel" | "ItemDescription", tag: "label" | "p") {
  return defineComponent({
    name: `RadioGroup${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as ItemSlots,
    setup(props, { attrs, slots }) {
      const ctx = useGroup(name)
      const item = useItem(name)
      const set = name === "ItemLabel" ? item.setLabelRendered : item.setDescriptionRendered
      onMounted(() => set(true))
      onBeforeUnmount(() => set(false))
      const env = useEnvironment()
      const labelable = () => item.controlTag() === "button" || item.controlTag() === "input"
      // A non-labelable control (a substituted span): a press on the label focuses and checks
      // it (spec "Activation"), with the double-click text-selection guard.
      const interaction =
        name === "ItemLabel"
          ? normalizeProps(
              labelInteraction(env, {
                target: () => item.controlEl.value as HTMLElement | null,
                forwardsFocus: () => !labelable(),
                focusTarget: () => {
                  const control = item.controlEl.value as HTMLElement | null
                  if (control) void focusSafely(control, env, "programmatic")
                  if (!item.disabled())
                    ctx.send({ type: "PRESS", key: item.key(), modality: env.modality.modality() })
                },
              }),
            )
          : {}
      return () => {
        const own =
          name === "ItemLabel"
            ? ctx.api().itemLabel(item.key(), {
                disabled: item.disabled(),
                labelable: item.controlTag() === "button" || item.controlTag() === "input",
              })
            : ctx.api().itemDescription(item.key(), { disabled: item.disabled() })
        return renderPart(
          tag,
          mergeProps({ ...normalizeProps(own), ...interaction }, attrs),
          slots.default?.({ checked: ctx.value() === item.key(), disabled: item.disabled() }),
          props.asChild,
        )
      }
    },
  })
}
const ItemLabel = itemText("ItemLabel", "label")
const ItemDescription = itemText("ItemDescription", "p")

/** The parts, by name: `radio-group.parts.ts` re-exports them as the `RadioGroup` namespace. */
export {
  Description,
  ErrorMessage,
  Item,
  ItemControl,
  ItemDescription,
  ItemIndicator,
  ItemLabel,
  Label,
  Root,
}
