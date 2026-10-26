import {
  type ChangeDetails,
  type CheckboxGroupEvent,
  checkboxGroupConnect,
  checkboxGroupMachine,
  focusSafely,
  type Modality,
  mergeFieldProps,
  partId,
  readValidity,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
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
import { Checkbox } from "../checkbox/checkbox"
import { changeEmitter } from "../emit-change"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import {
  type FormToggleGrouped,
  type FormToggleGrouping,
  FormToggleGroupingKey,
} from "../form-toggle/form-toggle"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly api: () => ReturnType<typeof checkboxGroupConnect>
  readonly registry: PartRegistry<GroupPart>
  readonly ids: () => { label: string; description: string; errorMessage: string }
  readonly setLabelTag: (tag: string) => void
  readonly hasParent: () => boolean
  /** The group's own ErrorMessage defers to the Field's inside one. */
  readonly inField: boolean
  readonly invalid: () => boolean
  readonly parentGrouping: FormToggleGrouping
}
const GroupKey: InjectionKey<Ctx> = Symbol("rind-ui.checkbox-group")
function useGroup(part: string): Ctx {
  const ctx = inject(GroupKey, null)
  if (!ctx) throw new Error(`CheckboxGroup.${part} must be inside CheckboxGroup.Root`)
  return ctx
}

export interface CheckboxGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "CheckboxGroupRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`). */
    modelValue: { type: Array as PropType<readonly string[]>, default: undefined },
    defaultValue: { type: Array as PropType<readonly string[]>, default: undefined },
    /** Every item value: what the select-all Parent selects (required with a Parent). */
    allValues: { type: Array as PropType<readonly string[]>, default: undefined },
    disabled: Boolean,
    readonly: Boolean,
    /** Valid with at least one item checked. */
    required: Boolean,
    invalid: Boolean,
    /** Submitted for every checked item (an item's own `name` is ignored). */
    name: String,
    form: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: readonly string[], _details: ChangeDetails<CheckboxGroupEvent>) => true,
    "update:modelValue": (_value: readonly string[]) => true,
  },
  slots: Object as SlotsType<{ default?: (state: CheckboxGroupState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const binding = useFieldControl()
    const fieldsetDisabled = useFieldsetDisabled()
    // A native <fieldset disabled> too: the items are disabled by it (toggle.md RA#9445).
    const fieldsetDom = shallowRef(false)
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "group",
          labelable: false,
          disabled: props.disabled || fieldsetDisabled.value || fieldsetDom.value,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
        },
        binding?.value ?? null,
      ),
    )
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      const node = el.value
      if (!node) return
      const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
      fieldsetDom.value = watch.disabled
      onBeforeUnmount(watch.stop)
    })
    const measured = shallowRef<string | null>(null)
    onMounted(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    onUpdated(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    let labelTag = "span"
    // The reason of the latest accepted change, for the Field: only a user's clears its
    // external (server) errors (base-ui#1745); a parent's value or a reset does not.
    let lastReason: string | null = null
    const emitChange = changeEmitter<readonly string[], CheckboxGroupEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(checkboxGroupMachine, () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (next: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => {
        lastReason = details.reason
        emitChange(next, details)
      },
      allValues: props.allValues,
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
    }))
    const current = () => view.value.values.value ?? []
    const registry = usePartRegistry<GroupPart>({ scope: "checkbox-group", root: instance() })
    const ids = () => ({
      label: partId("checkbox-group", instance(), "label"),
      description: partId("checkbox-group", instance(), "description"),
      errorMessage: partId("checkbox-group", instance(), "error-message"),
    })
    const rendered = {
      label: useRenderedId(registry, "label"),
      description: useRenderedId(registry, "description"),
      errorMessage: useRenderedId(registry, "error-message"),
    }
    const api = computed(() => {
      // Rendered item Control ids in `allValues` order (the Parent's aria-controls).
      const items = view.value.context.items
      const order = props.allValues ?? [...items.keys()]
      const controls = order.flatMap((v) => {
        const item = items.get(v)
        return item ? [item.id] : []
      })
      return checkboxGroupConnect({
        instance: instance(),
        value: current(),
        allValues: props.allValues ?? [],
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
        required: field.value.required || field.value["aria-required"] === "true",
        invalid: field.value.invalid,
        name: field.value.name,
        form: props.form,
        rootTag: renderedTag("div", undefined, props.asChild, measured.value),
        labelTag,
        ids: ids(),
        rendered: {
          label: rendered.label.value,
          description: rendered.description.value,
          errorMessage: rendered.errorMessage.value,
        },
        ...(binding ? { field: binding.value.ids } : {}),
        controls,
      })
    })
    // One stable register function per item value: re-renders never re-register.
    const registers = new Map<string, (controlId: string, disabled: boolean) => () => void>()
    const registerFor = (v: string) => {
      let fn = registers.get(v)
      if (!fn) {
        fn = (controlId, isDisabled) => {
          send({ type: "ITEM.REGISTER", value: v, id: controlId, disabled: isDisabled })
          return () => send({ type: "ITEM.UNREGISTER", value: v, id: controlId })
        }
        registers.set(v, fn)
      }
      return fn
    }
    const itemGrouping = computed<FormToggleGrouping>(() => {
      const a = api.value
      return {
        resolve: (v, own) => {
          if (process.env.NODE_ENV !== "production" && v === "on") {
            // The Checkbox default value: an item without its own `value`.
            console.error("[rind-ui] checkbox-group: an item needs a `value`")
          }
          return {
            props: a.item(v, own),
            onChange: (checked: boolean | "indeterminate", modality: Modality) =>
              send({ type: "ITEM.TOGGLE", value: v, checked: checked === true, modality }),
            register: registerFor(v),
          } satisfies FormToggleGrouped
        },
      }
    })
    const parentGrouping: FormToggleGrouping = {
      resolve: () => ({
        props: api.value.parent(),
        onChange: (_checked, modality) => send({ type: "PARENT.TOGGLE", modality }),
      }),
    }
    // The items' hidden inputs (the Parent's submits nothing and validates nothing).
    const controlInputs = () =>
      Array.from(
        el.value?.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]') ?? [],
      ).filter((i) => i.closest("[data-parent]") === null)
    onMounted(() => {
      // Development: `allValues` and the rendered items must agree (the Parent selects them).
      watch(
        () =>
          [
            [...view.value.context.items.keys()].sort().join("\u0000"),
            props.allValues ? [...props.allValues].sort().join("\u0000") : null,
          ] as const,
        ([registeredKey, allKey]) => {
          if (process.env.NODE_ENV === "production" || allKey === null || registeredKey === "")
            return
          const registered = registeredKey.split("\u0000")
          const all = allKey.split("\u0000")
          const extra = registered.filter((v) => !all.includes(v))
          const missing = all.filter((v) => !registered.includes(v))
          if (extra.length > 0)
            console.warn(
              `[rind-ui] checkbox-group: items ${JSON.stringify(extra)} are not in allValues`,
            )
          if (missing.length > 0)
            console.warn(
              `[rind-ui] checkbox-group: allValues ${JSON.stringify(missing)} have no rendered item`,
            )
        },
        { immediate: true, flush: "post" },
      )
      // A form reset is answered once, by the group, for every item (RA#7749).
      const node = el.value
      if (node) {
        const doc = node.ownerDocument
        const onReset = (e: Event) => {
          if (e.defaultPrevented) return
          const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
          if (input && e.target === input.form) send({ type: "RESET" })
        }
        doc.addEventListener("reset", onReset)
        onBeforeUnmount(() => doc.removeEventListener("reset", onReset))
      }
      // field-control: the group registers once as one (non-labelable) control.
      if (binding) {
        const off = binding.value.register(
          {
            id: instance(),
            labelable: false,
            // The first invalid item, else the first enabled one (base-ui#5200).
            focus: (modality) => {
              const inputs = controlInputs()
              const target =
                inputs.find((i) => !i.disabled && !readValidity(i).valid) ??
                inputs.find((i) => !i.disabled)
              const control = target?.closest('[data-scope="checkbox"][data-part="root"]')
              const button = control?.querySelector<HTMLElement>('[data-part="control"]')
              if (button) void focusSafely(button, env, "programmatic", modality)
            },
            validityElement: () =>
              controlInputs().find((i) => !readValidity(i).valid) ?? controlInputs()[0] ?? null,
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
        const user = lastReason === "ITEM.TOGGLE" || lastReason === "PARENT.TOGGLE"
        lastReason = null
        binding?.value.report({ type: "change", value: now, user, composing: false })
        binding?.value.report({ type: "commit" })
      })
    })
    provide(GroupKey, {
      api: () => api.value,
      registry,
      ids,
      setLabelTag: (tag) => {
        labelTag = tag
      },
      hasParent: () => props.allValues !== undefined,
      inField: binding !== null,
      invalid: () => field.value.invalid,
      parentGrouping,
    })
    provide(FormToggleGroupingKey, itemGrouping)
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps({ ...api.value.root(), ...binding?.value.data }),
          ...(props.id === undefined ? {} : { id: props.id }),
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

const Label = defineComponent({
  name: "CheckboxGroupLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("Label")
    useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
    return () => {
      const children = slots["default"]?.()
      ctx.setLabelTag(renderedTag("span", children, props.asChild))
      return renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().label()), attrs),
        children,
        props.asChild,
      )
    }
  },
})

const Description = defineComponent({
  name: "CheckboxGroupDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("Description")
    useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
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
  name: "CheckboxGroupErrorMessage",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useGroup("ErrorMessage")
    // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
    const shown = () => !ctx.inField && ctx.invalid()
    useRegisterPart(ctx.registry, "error-message", () =>
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

/** The select-all checkbox: a Checkbox whose state the group derives. */
const Parent = defineComponent({
  name: "CheckboxGroupParent",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useGroup("Parent")
    if (process.env.NODE_ENV !== "production" && !ctx.hasParent()) {
      console.error("[rind-ui] checkbox-group: a Parent needs `allValues` on CheckboxGroup.Root")
    }
    provide(
      FormToggleGroupingKey,
      computed(() => ctx.parentGrouping),
    )
    return () => h(Checkbox.Root, attrs, slots)
  },
})

/**
 * A checkbox: inside `CheckboxGroup.Root` one of the group's (its `value` joins the group's
 * value); alone, a single two- or three-state checkbox with its own `checked`.
 */
const Item = Checkbox.Root
/** Its check mark (or the indeterminate dash), rendered while checked. */
const ItemIndicator = Checkbox.Indicator
/** The item's (or the Parent's) focusable box. The group's own Label/Description are separate. */
const ItemControl = Checkbox.Control
/** The item's label; names its Control. */
const ItemLabel = Checkbox.Label
/** The item's description, wired into `aria-describedby`. */
const ItemDescription = Checkbox.Description

/** The parts, by name: `checkbox-group.parts.ts` re-exports them as the `CheckboxGroup` namespace. */
export {
  Description,
  ErrorMessage,
  Item,
  ItemControl,
  ItemDescription,
  ItemIndicator,
  ItemLabel,
  Label,
  Parent,
  Root,
}
