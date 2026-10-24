// The parts every form toggle shares (Checkbox, Switch): a button-like Control with a
// checkable role, Label/Description (control-label) and the hidden form input
// (hidden-form-input), wired to the component's own machine through `useService`.
import {
  type BlurEvent,
  blurEvent,
  type CheckedState,
  checkboxConnect,
  type FocusEvent,
  type FormInputCapability,
  focusEvent,
  focusSafely,
  type GroupedCheckbox,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  partId,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type ComputedRef,
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  shallowRef,
  watch,
} from "vue"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { elementOf, mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

const mirrorOf = (v: CheckedState) => ({
  checked: v === true,
  indeterminate: v === "indeterminate",
})

export interface FormToggleState<V extends CheckedState = CheckedState> {
  readonly checked: V
  readonly disabled: boolean
  readonly readOnly: boolean
}

/** The events a form toggle's machine takes from its parts. */
export type FormToggleEvent =
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  | { readonly type: "RESET" }
  | FocusEvent
  | BlurEvent

/** What the shared parts read from a component's machine. */
export interface FormToggleService {
  readonly checked: () => CheckedState
  readonly focused: () => boolean
  send(event: FormToggleEvent): void
}

/** The machine props a component's `useService` receives (getters: read at use). */
export interface FormToggleServiceProps<V extends CheckedState, D> {
  readonly checked: V | undefined
  readonly defaultChecked: V
  readonly onCheckedChange: (checked: V, details: D) => void
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface FormToggleConfig<V extends CheckedState, D> {
  readonly scope: "checkbox" | "switch"
  readonly role: "checkbox" | "switch"
  /** The decorative part ("indicator", or the Switch's "thumb"). */
  readonly indicatorPart: "indicator" | "thumb"
  /** Names the component in errors ("Checkbox", "Switch"). */
  readonly label: string
  /** Public part names for guard messages (default `<label>.<Part>`). */
  readonly partNames?: Partial<
    Record<"Root" | "Control" | "Indicator" | "Label" | "Description", string>
  >
  /** The component's own machine (useMachine), in setup. */
  readonly useService: (
    props: () => FormToggleServiceProps<V, D>,
    formInput: FormInputCapability,
  ) => FormToggleService
}

interface Ctx {
  readonly config: FormToggleConfig<CheckedState, unknown>
  readonly instance: () => string
  readonly service: FormToggleService
  readonly binding: ReturnType<typeof useFieldControl>
  readonly own: () => {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean
    readonly name: string | undefined
  }
  readonly focusableWhenDisabled: () => boolean
  readonly ids: () => { control: string; label: string; description: string; hiddenInput: string }
  readonly registry: PartRegistry<"label" | "description">
  readonly controlEl: { value: Element | null }
  readonly inputEl: { value: HTMLInputElement | null }
  readonly controlTag: () => string
  readonly setControlTag: (tag: string) => void
  readonly hidden: () => { value: string; form: string | undefined; defaultChecked: CheckedState }
  readonly uncheckedValue: () => string | undefined
  /** Driven by a group (an item, or the group's select-all Parent). */
  readonly grouped: () => FormToggleGrouped | null
}

/** How a Checkbox Group (or its select-all Parent) drives a Checkbox inside it. */
export interface FormToggleGrouping {
  /** The props for the Checkbox with this `value`, or null when it is not grouped. */
  resolve(
    value: string,
    own: { readonly disabled: boolean; readonly readOnly: boolean; readonly required: boolean },
  ): FormToggleGrouped | null
}

export interface FormToggleGrouped {
  readonly props: GroupedCheckbox
  /** The user's proposal: the group decides. */
  onChange(checked: CheckedState, modality: Modality): void
  /** The rendered Control's id and disabled flag; returns the unregistration. */
  register?(controlId: string, disabled: boolean): () => void
}

/** Provided by CheckboxGroup.Root and its Parent; only checkboxes read it. */
export const FormToggleGroupingKey: InjectionKey<ComputedRef<FormToggleGrouping | null>> = Symbol(
  "rind-ui.form-toggle-grouping",
)

const FormToggleKey: InjectionKey<Ctx> = Symbol("rind-ui.form-toggle")
function useFormToggle(part: string, root: string): Ctx {
  const ctx = inject(FormToggleKey, null)
  if (!ctx) throw new Error(`${part} must be inside ${root}`)
  return ctx
}

/** The connect output for a part, with that part's interaction state. Call in setup. */
function useApi(ctx: Ctx) {
  const env = useEnvironment()
  const modality = useModality(env.modality, () => ctx.service.focused())
  const description = useRenderedId(ctx.registry, "description")
  const label = useRenderedId(ctx.registry, "label")
  return (
    extra: {
      pressed?: boolean
      hovered?: boolean
      describedBy?: string | undefined
      ariaLabel?: string | undefined
      ariaLabelledBy?: string | undefined
    } = {},
  ) => {
    const labelable = ctx.controlTag() === "button" || ctx.controlTag() === "input"
    const grouped = ctx.grouped()
    const field = mergeFieldProps(
      {
        role: ctx.config.role,
        labelable,
        ...ctx.own(),
        describedBy: description.value,
        consumerDescribedBy:
          [extra.describedBy, grouped?.props.describedBy].filter(Boolean).join(" ") || undefined,
        ariaLabel: extra.ariaLabel,
        ariaLabelledBy: extra.ariaLabelledBy,
      },
      ctx.binding?.value ?? null,
    )
    const hidden = ctx.hidden()
    return checkboxConnect(
      {
        scope: ctx.config.scope,
        role: ctx.config.role,
        indicatorPart: ctx.config.indicatorPart,
        instance: ctx.instance(),
        checked: ctx.service.checked(),
        tag: ctx.controlTag(),
        labelable,
        field,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        focused: ctx.service.focused(),
        modality: modality.value,
        pressed: extra.pressed ?? false,
        hovered: extra.hovered ?? false,
        ids: ctx.ids(),
        labelRendered: label.value !== undefined,
        fieldData: ctx.binding?.value.data,
        value: hidden.value,
        form: hidden.form,
        defaultChecked: hidden.defaultChecked,
        uncheckedValue: ctx.uncheckedValue(),
      },
      env,
    )
  }
}

/** The parts of one form toggle component, wired to its machine. */
/* @__NO_SIDE_EFFECTS__ */
export function createFormToggle<V extends CheckedState, D>(config: FormToggleConfig<V, D>) {
  // The shared parts read the service through CheckedState; V narrows it per component.
  const shared = config as unknown as FormToggleConfig<CheckedState, unknown>
  const partName = (part: "Root" | "Control" | "Indicator" | "Label" | "Description") =>
    config.partNames?.[part] ?? `${config.label}.${part}`
  const checkedProp = {
    type: [Boolean, String] as PropType<V>,
    default: undefined,
  }
  const stateOf = (ctx: Ctx, api: ReturnType<ReturnType<typeof useApi>>): FormToggleState<V> => {
    const root = api.root()
    return {
      checked: ctx.service.checked() as V, // the service holds this component's value type
      disabled: root["data-disabled"] !== undefined,
      readOnly: root["data-readonly"] !== undefined,
    }
  }

  const Root = defineComponent({
    name: `${config.label}Root`,
    inheritAttrs: false,
    props: {
      /** Controlled value (`v-model:checked`). */
      checked: checkedProp,
      /** Read at creation; a later change only changes what a form reset restores. */
      defaultChecked: { type: [Boolean, String] as PropType<V>, default: false },
      /** Ignores activation. In a Checkbox Group the group's `disabled` also applies. */
      disabled: Boolean,
      /** Disabled but still in the Tab order (`aria-disabled`). */
      focusableWhenDisabled: Boolean,
      /** Keeps focus and value, ignores activation. */
      readonly: Boolean,
      /** Must be checked to submit. A Checkbox Group Parent is never required. */
      required: Boolean,
      /** Marks the toggle invalid (`aria-invalid`, `data-invalid`). */
      invalid: Boolean,
      /** The submitted field name; ignored in a Checkbox Group (the group's `name` applies). */
      name: String,
      /** Submitted while checked (default "on"). */
      value: { type: String, default: "on" },
      /** The id of the form the hidden input belongs to. */
      form: String,
      /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
      uncheckedValue: String,
      id: String,
      ...asChildProp,
    },
    emits: {
      /** Every user-caused change (toggle or form reset); never for a parent change. */
      checkedChange: (_checked: V, _details: D) => true,
      "update:checked": (_checked: V) => true,
    },
    setup(props, { attrs, slots, emit }) {
      const env = useEnvironment()
      const instance = useRootId(() => props.id)
      // Inside a Checkbox Group: the group owns the value, the flags and the Field binding.
      const grouping = inject(FormToggleGroupingKey, null)
      const grouped = computed(() =>
        config.scope === "checkbox"
          ? (grouping?.value?.resolve(props.value, {
              disabled: props.disabled,
              readOnly: props.readonly,
              required: props.required,
            }) ?? null)
          : null,
      )
      const binding = useFieldControl({ skip: grouped.value !== null })
      const controlEl = shallowRef<Element | null>(null)
      const inputEl = shallowRef<HTMLInputElement | null>(null)
      const controlTag = shallowRef("button")
      // A rind-ui Fieldset's injection reaches teleported parts; the DOM tracker native fieldsets.
      const fieldsetContext = useFieldsetDisabled()
      const fieldsetDom = shallowRef(false)
      const field = computed(() => {
        const g = grouped.value
        return mergeFieldProps(
          {
            role: config.role,
            labelable: true,
            disabled:
              (g?.props.disabled ?? props.disabled) || fieldsetContext.value || fieldsetDom.value,
            readOnly: g?.props.readOnly ?? props.readonly,
            required: g?.props.required ?? props.required,
            invalid: g?.props.invalid ?? props.invalid,
            name: g ? g.props.name : props.name,
          },
          binding?.value ?? null,
        )
      })
      const formInput = hiddenFormInput(
        { input: () => inputEl.value, control: () => controlEl.value as HTMLElement | null },
        env,
      )
      // The reason of the latest proposal, for the Field's change report (user or reset).
      let lastReason: string | null = null
      const service = config.useService(
        () => ({
          // A grouped checkbox is controlled by its group (its CheckedState).
          checked: grouped.value ? (grouped.value.props.checked as V) : props.checked,
          defaultChecked: props.defaultChecked as V,
          onCheckedChange: (next: V, details: D) => {
            lastReason = (details as { reason?: string }).reason ?? null // ChangeDetails
            const g = grouped.value
            if (g) {
              // The proposal's TOGGLE carries the modality (a RESET never reaches a grouped one).
              const event = (details as { event?: { modality?: Modality } }).event
              g.onChange(next, event?.modality ?? "virtual")
            }
            let cancelled = false
            const d = details as { cancel?: () => void }
            emit(
              "checkedChange",
              next,
              (d.cancel
                ? {
                    ...d,
                    cancel: () => {
                      cancelled = true
                      d.cancel?.()
                    },
                  }
                : details) as D,
            )
            if (!cancelled) emit("update:checked", next)
          },
          disabled: field.value.disabled,
          readOnly: field.value.readOnly,
        }),
        formInput,
      )
      const current = () => service.checked()
      // After every render: the input reflects the value (hydration, re-renders); no events.
      const sync = () => formInput.sync(mirrorOf(current()), { dispatch: false })
      onMounted(() => {
        sync()
        const node = controlEl.value
        if (node) {
          const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
          fieldsetDom.value = w.disabled
          onBeforeUnmount(w.stop)
        }
        let stopTrack: (() => void) | undefined
        watch(
          () => grouped.value !== null,
          (isGrouped) => {
            stopTrack?.()
            stopTrack = formInput.track({
              onReset: () => service.send({ type: "RESET" }),
              current: () => mirrorOf(current()),
              // A group answers its form's reset once, for every item.
              resetsWithForm: !isGrouped,
            })
          },
          { immediate: true },
        )
        onBeforeUnmount(() => stopTrack?.())
        // field-control: register, report each accepted toggle and reset.
        let unregister: (() => void) | undefined
        watch(
          () => [ids.value.control, controlTag.value] as const,
          ([control, tag]) => {
            unregister?.()
            unregister = binding?.value.register(
              {
                id: control,
                labelable: tag === "button" || tag === "input",
                focus: (modality) => {
                  const el = controlEl.value
                  if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
                },
                validityElement: () => inputEl.value,
                value: () => current(),
              },
              control,
            )
          },
          { immediate: true },
        )
        onBeforeUnmount(() => unregister?.())
        let reported = current()
        watch(current, (now) => {
          if (reported === now) return
          reported = now
          const user = lastReason === "TOGGLE"
          lastReason = null
          binding?.value.report({ type: "change", value: now, user, composing: false })
          binding?.value.report({ type: "commit" })
        })
      })
      onUpdated(sync)
      const ids = computed(() => ({
        control: binding?.value.controlId ?? partId(config.scope, instance(), "control"),
        label: partId(config.scope, instance(), "label"),
        description: partId(config.scope, instance(), "description"),
        hiddenInput: partId(config.scope, instance(), "hidden-input"),
      }))
      const registry = usePartRegistry<"label" | "description">({
        scope: config.scope,
        root: instance(),
      })
      const ctx: Ctx = {
        config: shared,
        instance,
        service,
        binding,
        own: () => ({
          disabled: field.value.disabled,
          readOnly: field.value.readOnly,
          required: grouped.value?.props.required ?? props.required,
          invalid: grouped.value?.props.invalid ?? props.invalid,
          name: field.value.name,
        }),
        focusableWhenDisabled: () => props.focusableWhenDisabled,
        ids: () => ids.value,
        registry,
        controlEl,
        inputEl,
        controlTag: () => controlTag.value,
        setControlTag: (tag) => (controlTag.value = tag),
        hidden: () => ({
          value: props.value,
          form: grouped.value ? grouped.value.props.form : props.form,
          // A grouped item's server HTML submits its membership before hydration; its reset is
          // the group's (which re-syncs every item), so the attribute follows the group.
          defaultChecked: grouped.value ? grouped.value.props.checked : props.defaultChecked,
        }),
        uncheckedValue: () => props.uncheckedValue,
        grouped: () => grouped.value,
      }
      provide(FormToggleKey, ctx)
      const apiFor = useApi(ctx)
      return () => {
        const api = apiFor()
        const merged = mergeProps(
          {
            ...normalizeProps({ ...api.root(), ...grouped.value?.props.root }),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        )
        const unchecked = api.uncheckedInput()
        const state: FormToggleState<V> = {
          checked: current() as V, // the service holds this component's value type
          disabled: field.value.disabled,
          readOnly: field.value.readOnly,
        }
        return renderPart(
          "div",
          merged,
          [
            slots["default"]?.(state),
            // After the control: never a wrapping label's first labelable descendant.
            renderPart(
              "input",
              {
                ...normalizeProps(api.hiddenInput()),
                ref: refTo(inputEl),
              },
              undefined,
            ),
            unchecked ? renderPart("input", normalizeProps(unchecked), undefined) : null,
          ],
          props.asChild,
        )
      }
    },
  })

  const Control = defineComponent({
    name: `${config.label}Control`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useFormToggle(partName("Control"), partName("Root"))
      const env = useEnvironment()
      // The modality tracker must see the pointerdown that comes before focus.
      onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
      const el = shallowRef<Element | null>(null)
      // Stable: a new ref function on every render would detach and reattach the element.
      const setEl = (node: unknown) => {
        el.value = elementOf(node)
        ctx.controlEl.value = el.value
      }
      const measured = shallowRef<string | null>(null)
      const measure = () => {
        measured.value = el.value?.tagName.toLowerCase() ?? null
        ctx.setControlTag(measured.value ?? "button")
      }
      onMounted(measure)
      onUpdated(measure)
      const disabled = () => ctx.own().disabled || ctx.binding?.value.state.disabled === true
      const press = usePress({
        env,
        // Only the activation toggles; PRESS.* drive data-pressed.
        send: (e) => {
          if (e.type === "PRESS") ctx.service.send({ type: "TOGGLE", modality: e.modality })
        },
        disabled,
      })
      const hover = useHover({ env, send: () => {}, disabled })
      const apiFor = useApi(ctx)
      const own = computed(() => {
        const api = apiFor({
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
          describedBy: attrs["aria-describedby"] as string | undefined,
          ariaLabel: attrs["aria-label"] as string | undefined,
          ariaLabelledBy: attrs["aria-labelledby"] as string | undefined,
        })
        return normalizeProps({ ...api.control(), ...ctx.grouped()?.props.control })
      })
      // Grouped: the group needs the rendered Control's id (aria-controls) and disabled flag.
      // Primitive sources: re-registered only when one of them changes.
      const controlDisabled = computed(
        () => own.value["disabled"] === true || own.value["aria-disabled"] === "true",
      )
      onMounted(() => {
        let stop: (() => void) | undefined
        watch(
          // Getters, not the refs: a shallowRef source forces the callback on every trigger.
          [() => ctx.grouped()?.register, () => el.value, () => controlDisabled.value],
          ([register, node, isDisabled]) => {
            stop?.()
            stop = undefined
            if (register && node) stop = register(node.id, isDisabled)
          },
          { immediate: true, flush: "post" },
        )
        onBeforeUnmount(() => stop?.())
      })
      return () => {
        const children = slots["default"]?.({
          checked: ctx.service.checked() as V,
          disabled: ctx.own().disabled,
          readOnly: ctx.own().readOnly,
        })
        const { "aria-describedby": _d, "aria-labelledby": _l, ...rest } = attrs
        const merged = mergeProps(
          {
            ...joinHandlers(
              own.value,
              {
                // Enter submits the form (implicit submission); it never toggles. Before press,
                // which prevents Enter's native click; a consumer's preventDefault (its
                // handlers run first) still cancels the submission.
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
                  implicitSubmit(ctx.inputEl.value?.form ?? null)
                },
              },
              press.props,
              hover.props,
              {
                onFocusin: (e: Event) =>
                  ctx.service.send(focusEvent(e.currentTarget as Element, env.modality)),
                onFocusout: () => ctx.service.send(blurEvent(env.modality)),
              },
            ),
            ref: setEl,
          },
          rest,
        )
        return renderPart("button", merged, children, props.asChild)
      }
    },
  })

  const Indicator = defineComponent({
    name: `${config.label}${config.indicatorPart === "thumb" ? "Thumb" : "Indicator"}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    // The default slot receives `{ checked, indeterminate }` (draw a check or a dash).
    setup(props, { attrs, slots }) {
      const ctx = useFormToggle(
        config.indicatorPart === "thumb" ? `${config.label}.Thumb` : partName("Indicator"),
        partName("Root"),
      )
      const apiFor = useApi(ctx)
      return () => {
        const value = ctx.service.checked()
        return renderPart(
          "span",
          mergeProps(normalizeProps(apiFor().indicator()), attrs),
          slots["default"]?.({ checked: value === true, indeterminate: value === "indeterminate" }),
          props.asChild,
        )
      }
    },
  })

  const Label = defineComponent({
    name: `${config.label}Label`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useFormToggle(partName("Label"), partName("Root"))
      const env = useEnvironment()
      useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
      const apiFor = useApi(ctx)
      // An own Label inside a Field: the Field's names the control.
      const inField = ctx.binding !== null
      onMounted(() => {
        if (inField) warnOwnLabelInField(config.scope)
      })
      const interaction = normalizeProps(
        labelInteraction(env, {
          target: () => ctx.controlEl.value,
          forwardsFocus: () => !(ctx.controlTag() === "button" || ctx.controlTag() === "input"),
          // The non-labelable fallback: focus the control and toggle it once.
          focusTarget: () => {
            const control = ctx.controlEl.value
            if (control instanceof HTMLElement) void focusSafely(control, env, "programmatic")
            ctx.service.send({ type: "TOGGLE", modality: env.modality.modality() })
          },
        }),
      )
      return () => {
        const api = apiFor()
        const merged = mergeProps(
          {
            ...normalizeProps(api.label()),
            // Inside a Field the Field's Label names the control: this one must not as well.
            ...(inField ? { for: undefined } : {}),
            ...interaction,
          },
          attrs,
        )
        return renderPart("label", merged, slots["default"]?.(stateOf(ctx, api)), props.asChild)
      }
    },
  })

  const Description = defineComponent({
    name: `${config.label}Description`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useFormToggle(partName("Description"), partName("Root"))
      useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
      const apiFor = useApi(ctx)
      return () => {
        const api = apiFor()
        return renderPart(
          "div",
          mergeProps(normalizeProps(api.description()), attrs),
          slots["default"]?.(stateOf(ctx, api)),
          props.asChild,
        )
      }
    },
  })

  return { Root, Control, Indicator, Label, Description }
}
