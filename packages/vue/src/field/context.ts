// The Field's context for control authors (field-control), apart from the Field's own parts: a
// control that registers with a Field ships without the Field's machine.
import type {
  FieldControlBinding,
  FieldMessages,
  MessageOverrides,
  Validate,
  ValidationBehavior,
  ValidationMode,
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  type PropType,
  provide,
  useId,
} from "vue"

/** The binding a rind-ui form control reads in its Root (field-control). */
export const FieldControlKey: InjectionKey<ComputedRef<FieldControlBinding> | null> =
  Symbol("rind-ui.field-control")
/** Under an embedded boundary: controls join no Field and create none (field-control). */
export const EmbeddedKey: InjectionKey<boolean> = Symbol("rind-ui.field-embedded")

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
