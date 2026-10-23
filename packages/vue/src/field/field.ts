import {
  announcerCapability,
  type FieldControlBinding,
  type FieldControlReport,
  type FieldMessages,
  type FieldPart,
  fieldConnect,
  fieldDisplay,
  fieldMachine,
  fieldMessages,
  formValues,
  getLayerStack,
  labelInteraction,
  type MessageOverrides,
  partId,
  type RegisteredControl,
  registerFormValue,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
  validityCapability,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type ComputedRef,
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { useFieldsetDisabled } from "../fieldset/context"
import { useFormBinding } from "../form/context"
import { elementOf, mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    field: FieldMessages
  }
}

/** The binding a rind-ui form control reads in its Root (field-control). */
const FieldControlKey: InjectionKey<ComputedRef<FieldControlBinding> | null> =
  Symbol("rind-ui.field-control")
/** Under an embedded boundary: controls join no Field and create none (field-control). */
const EmbeddedKey: InjectionKey<boolean> = Symbol("rind-ui.field-embedded")

/**
 * Marks a subtree whose form controls are a component's own (a Color Picker's inputs): they do
 * not register with the enclosing Field, do not become a Field themselves and get no Field
 * wiring.
 */
export const FieldControlBoundary = defineComponent({
  name: "FieldControlBoundary",
  setup(_, { slots }) {
    provide(FieldControlKey, null)
    provide(EmbeddedKey, true)
    return () => slots["default"]?.()
  },
})

/** Whether an enclosing Field exists (a Field host then joins it instead of creating one). */
export function useIsInsideField(): boolean {
  return inject(FieldControlKey, null) !== null || inject(EmbeddedKey, false)
}

/** The enclosing Field's binding without claiming it (a host's root reads its state). */
export function useFieldBindingPeek(): ComputedRef<FieldControlBinding> | null {
  return inject(FieldControlKey, null)
}

/**
 * For control authors: the enclosing Field's binding (read `.value`), or null outside a Field
 * or when another control claimed it first. Call in setup.
 */
export function useFieldControl(
  options: {
    /** Not a control of the Field (a group's item: the group registers): claims nothing. */
    readonly skip?: boolean
  } = {},
): ComputedRef<FieldControlBinding> | null {
  const context = inject(FieldControlKey, null)
  const binding = options.skip ? null : context
  const token = useId()
  // One control per Field: the first to claim the binding gets it, others get none.
  const owns = binding?.value.claim(token) ?? false
  onBeforeUnmount(() => binding?.value.release(token))
  return owns ? binding : null
}

interface PartsCtx {
  readonly instance: () => string
  readonly registry: PartRegistry<FieldPart>
  readonly api: () => ReturnType<typeof fieldConnect>
  readonly setLabel: (el: Element | null) => void
  readonly control: () => RegisteredControl | null
  readonly hasErrorPart: { current: number }
}
const PartsKey: InjectionKey<PartsCtx> = Symbol("rind-ui.field")
function useParts(part: string): PartsCtx {
  const ctx = inject(PartsKey, null)
  if (!ctx) throw new Error(`Field.${part} must be inside Field.Root`)
  return ctx
}

export interface FieldState {
  readonly valid: boolean
  readonly invalid: boolean
  readonly validating: boolean
}
type Slots = SlotsType<{ default?: (state: FieldState) => VNodeChild }>

/** The Field's props, shared with the Field hosts (Text Field, …). */
export const fieldRootProps = {
  name: String,
  disabled: Boolean,
  readonly: Boolean,
  required: Boolean,
  /** `true` forces invalid, `false` forces valid, `undefined` validates. */
  invalid: { type: Boolean, default: undefined },
  /** Controlled flags. */
  touched: { type: Boolean, default: undefined },
  dirty: { type: Boolean, default: undefined },
  /** External errors (server errors): shown at once, cleared by the next change. */
  errors: Array as PropType<readonly string[]>,
  validate: Function as PropType<Validate>,
  /** Default "submit". */
  validationMode: String as PropType<ValidationMode>,
  /** Default "native". */
  validationBehavior: String as PropType<ValidationBehavior>,
  validationDebounce: Number,
  /** "both" adds `aria-errormessage` to `aria-describedby`. */
  errorMessageAttribute: {
    type: String as PropType<"describedby" | "both">,
    default: "describedby",
  },
  messages: Object as PropType<MessageOverrides<FieldMessages>>,
  id: String,
} as const

const Root = defineComponent({
  name: "FieldRoot",
  inheritAttrs: false,
  props: {
    ...fieldRootProps,
    /** For Field hosts: the scope the Field's parts carry. Default `field`. */
    scope: String,
    /** For a Field host that is another component's part: its root's part name. */
    rootPart: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const env = useEnvironment(announcerCapability, validityCapability)
    const instance = useRootId(() => props.id)
    const messages = useMessages("field", fieldMessages, () => props.messages)
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () => props.disabled || fieldsetDisabled.value
    let labelEl: Element | null = null
    let registered: { control: RegisteredControl; label: string } | null = null
    /** The dirty baseline: the value at the first registration, once per Field. */
    let baseline: { value: unknown } | null = null
    /** Re-renders the Field (label `for`, listeners) when the registered control changes. */
    const version = shallowRef(0)
    /** The control that claimed the binding first; any other gets none (zag#2475). */
    let owner: string | null = null
    // Inside a Form: its defaults, its server errors by name, and it leads an attempt.
    const form = useFormBinding()
    const validationMode = () => props.validationMode ?? form?.validationMode ?? "submit"
    const validationBehavior = () =>
      props.validationBehavior ?? form?.validationBehavior ?? "native"
    const { view, send, service } = useMachine(
      fieldMachine,
      () => ({
        name: props.name,
        disabled: disabled(),
        readOnly: props.readonly,
        required: props.required,
        invalid: props.invalid,
        errors: props.errors ?? form?.errorsFor(props.name),
        managed: form !== null,
        validate: props.validate,
        validationMode: validationMode(),
        validationBehavior: validationBehavior(),
        validationDebounce: props.validationDebounce,
        messages: messages.value,
        label: () => (labelEl?.textContent ?? "").trim(),
        formValues: () => formValues(registered?.control.validityElement()?.form),
        control: () => registered?.control ?? null,
      }),
      env,
    )
    const registry = usePartRegistry<FieldPart>({ scope: "field", root: instance() })
    const labelId = useRenderedId(registry, "label")
    const descriptionId = useRenderedId(registry, "description")
    const errorId = useRenderedId(registry, "error-message")
    // The modality tracker must see the pointerdown that comes before focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const modality = useModality(env.modality, () => view.value.context.focused)
    const api = computed(() => {
      void version.value
      return fieldConnect({
        instance: instance(),
        state: view.value.state,
        context: view.value.context,
        props: {
          disabled: disabled(),
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
        },
        touched: props.touched,
        dirty: props.dirty,
        modality: modality.value,
        control: registered
          ? { id: registered.control.id, labelable: registered.control.labelable }
          : null,
        initial: baseline,
        name: props.name,
        scope: props.scope,
        ...(props.rootPart === undefined ? {} : { rootPart: props.rootPart }),
      })
    })
    const hasErrorPart = { current: 0 }
    // Stable functions: a control re-registers only when it remounts.
    const register = (control: RegisteredControl, label: string) => {
      registered = { control, label }
      baseline ??= { value: control.value() }
      version.value++
      send({ type: "CONTROL.REGISTER", control })
      return () => {
        if (registered?.control.id !== control.id) return
        registered = null
        version.value++
        send({ type: "CONTROL.UNREGISTER", id: control.id })
      }
    }
    const claim = (token: string) => {
      if (owner === null || owner === token) {
        owner = token
        return true
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[rind-ui] field: a second control (${token}) is inside one Field (the first is ${owner}); only the first is wired. Use a Fieldset to group controls.`,
        )
      }
      return false
    }
    const release = (token: string) => {
      if (owner === token) owner = null
    }
    const report = (event: FieldControlReport) => {
      if (event.type === "commit") send({ type: "CONTROL.COMMIT" })
      else
        send({
          type: "CONTROL.CHANGE",
          value: event.value,
          user: event.user,
          composing: event.composing,
        })
    }
    const binding = computed<FieldControlBinding>(() => ({
      ids: { label: labelId.value, description: descriptionId.value, error: errorId.value },
      data: api.value.controlData(),
      state: {
        disabled: disabled(),
        readOnly: props.readonly,
        required: props.required,
        invalid: api.value.display === "invalid",
        validationBehavior: validationBehavior(),
      },
      name: props.name,
      controlId: partId("field", instance(), "control"),
      errorMessageAttribute: props.errorMessageAttribute,
      register,
      report,
      claim,
      release,
    }))
    const root = shallowRef<Element | null>(null)
    onMounted(() => {
      // Focus entering and leaving the Field (layers opened from the control count as inside).
      const el = root.value
      if (el) {
        const inside = (target: EventTarget | null) =>
          getLayerStack(el.ownerDocument).isLogicallyInside(target, el)
        const onIn = (e: Event) => {
          if (!inside((e as FocusEvent).relatedTarget))
            send({ type: "FOCUS.ENTER", modality: env.modality.modality() })
        }
        const onOut = (e: Event) => {
          const related = (e as FocusEvent).relatedTarget
          if (related !== null) {
            if (!inside(related)) send({ type: "FOCUS.LEAVE" })
            return
          }
          // No related target: a click on the page background (leaving), or the window
          // losing focus (not leaving). Decided once the focus settled.
          const doc = el.ownerDocument
          env.scheduler.setTimeout(() => {
            if (doc.hasFocus() && !inside(doc.activeElement)) send({ type: "FOCUS.LEAVE" })
          }, 0)
        }
        el.addEventListener("focusin", onIn)
        el.addEventListener("focusout", onOut)
        onBeforeUnmount(() => {
          el.removeEventListener("focusin", onIn)
          el.removeEventListener("focusout", onOut)
        })
      }
      // The validity element can change when the control re-registers (`version`).
      let stop: (() => void) | undefined
      watch(
        [version, () => props.name],
        () => {
          stop?.()
          stop = undefined
          const input = registered?.control.validityElement()
          if (!input) return
          const onInvalid = (e: Event) => {
            // The browser's bubble only when no ErrorMessage part would show the error.
            if (hasErrorPart.current > 0) e.preventDefault()
            send({ type: "INVALID" })
          }
          const owningForm = input.form
          const onReset = (e: Event) => {
            // Who asked is known now, while the reset is being dispatched: a framework reset
            // after a form action keeps the server errors.
            const keepExternal = form?.resetOrigin() === "framework"
            // After the control reset itself, and only if nobody cancelled the reset.
            env.scheduler.setTimeout(() => {
              if (!e.defaultPrevented) send({ type: "RESET", keepExternal })
            }, 0)
          }
          // A submission the browser lets through is still an attempt; inside a Form the
          // Form leads the attempt (one per form, one focus, one summary).
          const onSubmit = () => {
            if (!form) send({ type: "SUBMIT.ATTEMPT" })
          }
          input.addEventListener("invalid", onInvalid)
          owningForm?.addEventListener("reset", onReset)
          owningForm?.addEventListener("submit", onSubmit, true)
          const unregister =
            owningForm && props.name
              ? registerFormValue(owningForm, props.name, () => registered?.control.value())
              : undefined
          stop = () => {
            input.removeEventListener("invalid", onInvalid)
            owningForm?.removeEventListener("reset", onReset)
            owningForm?.removeEventListener("submit", onSubmit, true)
            unregister?.()
          }
        },
        { immediate: true, flush: "post" },
      )
      onBeforeUnmount(() => stop?.())
      // Registered with the Form: it reads the display synchronously (right after an attempt).
      if (form) {
        const off = form.register({
          id: instance(),
          name: props.name,
          element: () => root.value,
          attempt: () => send({ type: "SUBMIT.ATTEMPT" }),
          status: () => {
            const snap = service.getSnapshot()
            return snap.state === "validating"
              ? "validating"
              : fieldDisplay(snap.state, snap.context, {
                  disabled: disabled(),
                  invalid: props.invalid,
                })
          },
          focus: () => registered?.control.focus("keyboard"),
          value: () => registered?.control.value(),
        })
        onBeforeUnmount(off)
      }
      // A held submission goes on once this Field's async check settled.
      watch(
        () => view.value.state === "validating",
        (validating, was) => {
          if (was && !validating) form?.settled()
        },
      )
    })
    provide(FieldControlKey, binding)
    provide(PartsKey, {
      instance,
      registry,
      api: () => api.value,
      setLabel: (el) => {
        labelEl = el
      },
      control: () => registered?.control ?? null,
      hasErrorPart,
    })
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps(api.value.root()),
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(root),
        },
        attrs,
      )
      const state: FieldState = {
        valid: api.value.display === "valid",
        invalid: api.value.display === "invalid",
        validating: view.value.state === "validating",
      }
      return renderPart("div", merged, slots.default?.(state), props.asChild)
    }
  },
})

const stateOf = (ctx: PartsCtx): FieldState => ({
  valid: ctx.api().display === "valid",
  invalid: ctx.api().display === "invalid",
  validating: false,
})

const Label = defineComponent({
  name: "FieldLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("Label")
    const env = useEnvironment()
    const own = () => props.id ?? partId("field", ctx.instance(), "label")
    useRegisterPart(ctx.registry, "label", own)
    // Stable: a new ref function on every render would detach and reattach the element.
    const setLabel = (node: unknown) => ctx.setLabel(elementOf(node))
    // A non-labelable control (a group) is named by aria-labelledby; a press focuses it.
    const interaction = normalizeProps(
      labelInteraction(env, {
        target: () => null,
        forwardsFocus: () => ctx.control()?.labelable === false,
        focusTarget: () => ctx.control()?.focus("pointer"),
      }),
    )
    return () => {
      const part = ctx.api().label(own())
      const merged = mergeProps(
        {
          ...normalizeProps({
            ...part,
            // Before the control registers (server render) the Field's control id is assumed.
            for: ctx.control() ? part["for"] : partId("field", ctx.instance(), "control"),
          }),
          ...interaction,
          ref: setLabel,
        },
        attrs,
      )
      return renderPart("label", merged, slots.default?.(stateOf(ctx)), props.asChild)
    }
  },
})

const Description = defineComponent({
  name: "FieldDescription",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("Description")
    const own = () => props.id ?? partId("field", ctx.instance(), "description")
    useRegisterPart(ctx.registry, "description", own)
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(ctx.api().description(own())), attrs),
        slots.default?.(stateOf(ctx)),
        props.asChild,
      )
  },
})

type ErrorSlots = SlotsType<{
  /** Replaces the default text; receives the messages. Empty output falls back to it. */
  default?: (messages: readonly string[]) => VNodeChild
}>

const ErrorMessageShown = defineComponent({
  name: "FieldErrorMessageShown",
  inheritAttrs: false,
  props: {
    own: { type: String, required: true },
    setEl: { type: Function as PropType<(el: Element | null) => void>, required: true },
    ...asChildProp,
  },
  slots: Object as ErrorSlots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("ErrorMessage")
    useRegisterPart(ctx.registry, "error-message", () => props.own)
    const setEl = (node: unknown) => props.setEl(elementOf(node))
    return () => {
      const messages = ctx.api().messages
      const fallback =
        messages.length > 1
          ? h(
              "ul",
              null,
              messages.map((m) => h("li", { key: m }, m)),
            )
          : messages[0]
      const given = slots.default?.(messages)
      const empty =
        given === undefined || given === null || (Array.isArray(given) && given.length === 0)
      return renderPart(
        "p",
        mergeProps(
          {
            ...normalizeProps(ctx.api().errorMessage(props.own)),
            ref: setEl,
          },
          attrs,
        ),
        empty ? fallback : given,
        props.asChild,
      )
    }
  },
})

const ErrorMessage = defineComponent({
  name: "FieldErrorMessage",
  inheritAttrs: false,
  props: {
    id: String,
    /** Rendered only when this validity key caused the error (one message per constraint). */
    match: String,
    ...asChildProp,
  },
  slots: Object as ErrorSlots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("ErrorMessage")
    // Counted while mounted: the Field cancels the browser bubble only when one exists.
    ctx.hasErrorPart.current += 1
    onBeforeUnmount(() => {
      ctx.hasErrorPart.current -= 1
    })
    const el = shallowRef<Element | null>(null)
    const open = () =>
      ctx.api().display === "invalid" &&
      (props.match === undefined || props.match === ctx.api().errorKey)
    const presence = usePresence(open, el)
    return () =>
      presence.mounted
        ? h(
            ErrorMessageShown,
            {
              ...attrs,
              asChild: props.asChild,
              own: props.id ?? partId("field", ctx.instance(), "error-message"),
              setEl: (node: Element | null) => (el.value = node),
            },
            slots,
          )
        : null
  },
})

/** The parts, by name: `field.parts.ts` re-exports them as the `Field` namespace. */
export { Description, ErrorMessage, Label, Root }
