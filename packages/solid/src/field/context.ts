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
  type Accessor,
  createComponent,
  createContext,
  createUniqueId,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

/** The binding a rind-ui form control reads in its Root (field-control). */
export const FieldControlContext = createContext<Accessor<FieldControlBinding> | null>(null)
/** Under an embedded boundary: controls join no Field and create none (field-control). */
export const EmbeddedContext = createContext(false)

/**
 * Marks a subtree whose form controls are a component's own (a Color Picker's inputs): they do
 * not register with the enclosing Field, do not become a Field themselves and get no Field
 * wiring.
 */
export function FieldControlBoundary(props: {
  /** The subtree whose form controls stay out of the enclosing Field. */
  readonly children?: JSX.Element
}): JSX.Element {
  return createComponent(FieldControlContext.Provider, {
    value: null,
    get children() {
      return createComponent(EmbeddedContext.Provider, {
        value: true,
        get children() {
          return props.children
        },
      })
    },
  })
}

/** Whether an enclosing Field exists (a Field host then joins it instead of creating one). */
export function useIsInsideField(): boolean {
  const embedded = useContext(EmbeddedContext)
  return useContext(FieldControlContext) !== null || embedded
}

/** The enclosing Field's binding without claiming it (a host's root reads its state). */
export function useFieldBindingPeek(): Accessor<FieldControlBinding> | null {
  return useContext(FieldControlContext)
}

/**
 * For control authors: the enclosing Field's binding (call it to read), or null outside a
 * Field or when another control claimed it first. Call it in a component.
 */
export function useFieldControl(
  options: {
    /** Not a control of the Field (a group's item: the group registers): claims nothing. */
    readonly skip?: boolean
  } = {},
): Accessor<FieldControlBinding> | null {
  const context = useContext(FieldControlContext)
  const binding = options.skip ? null : context
  const token = createUniqueId()
  // One control per Field: the first to claim the binding gets it, others get none.
  const owns = binding?.().claim(token) ?? false
  onCleanup(() => binding?.().release(token))
  return owns ? binding : null
}

/** The Field's own options, shared with the Field hosts (Text Field, …). */
export interface FieldRootOptions {
  readonly name?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  /** `true` forces invalid, `false` forces valid, `undefined` validates. */
  readonly invalid?: boolean | undefined
  /** Controlled flags. */
  readonly touched?: boolean | undefined
  readonly dirty?: boolean | undefined
  /** External errors (server errors): shown at once, cleared by the next change. */
  readonly errors?: readonly string[] | undefined
  readonly validate?: Validate | undefined
  /** Default "submit". */
  readonly validationMode?: ValidationMode | undefined
  /** Default "native". */
  readonly validationBehavior?: ValidationBehavior | undefined
  readonly validationDebounce?: number | undefined
  /** "both" adds `aria-errormessage` to `aria-describedby`. */
  readonly errorMessageAttribute?: "describedby" | "both" | undefined
  readonly messages?: MessageOverrides<FieldMessages> | undefined
  readonly id?: string | undefined
}

/** The keys of `FieldRootOptions` (for `splitProps`). */
export const fieldRootKeys = [
  "name",
  "disabled",
  "readOnly",
  "required",
  "invalid",
  "touched",
  "dirty",
  "errors",
  "validate",
  "validationMode",
  "validationBehavior",
  "validationDebounce",
  "errorMessageAttribute",
  "messages",
  "id",
] as const satisfies readonly (keyof FieldRootOptions)[]
