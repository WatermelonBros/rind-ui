import type { FieldControlBinding, FieldPart, fieldConnect, RegisteredControl } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"

/** The binding a rind-ui form control reads in its Root (field-control), through a getter. */
export const fieldControl = createContext<(() => FieldControlBinding) | null>("field-control")
/** Under an embedded boundary: controls join no Field and create none (field-control). */
export const fieldEmbedded = createContext<boolean>("field-embedded")

/** Whether an enclosing Field exists (a Field host then joins it instead of creating one). */
export function useIsInsideField(): boolean {
  return (fieldControl.maybe() ?? null) !== null || fieldEmbedded.maybe() === true
}

/** The enclosing Field's binding getter without claiming it (a host's root reads its state). */
export function useFieldBindingPeek(): (() => FieldControlBinding) | null {
  return fieldControl.maybe() ?? null
}

/**
 * For control authors: the enclosing Field's binding getter, or null outside a Field or when
 * another control claimed it first. `token` identifies the control (its `$props.id()`). Call
 * during component initialisation.
 */
export function useFieldControl(
  token: string,
  options: {
    /** Not a control of the Field (a group's item: the group registers): claims nothing. */
    readonly skip?: boolean
  } = {},
): (() => FieldControlBinding) | null {
  const context = fieldControl.maybe() ?? null
  const binding = options.skip ? null : context
  // One control per Field: the first to claim the binding gets it, others get none.
  const owns = binding?.().claim(token) ?? false
  $effect(() => () => binding?.().release(token))
  return owns ? binding : null
}

export const fieldParts = createContext<{
  readonly instance: () => string
  readonly registry: PartRegistry<FieldPart>
  readonly api: () => ReturnType<typeof fieldConnect>
  readonly setLabel: (el: Element | null) => void
  readonly control: () => RegisteredControl | null
  readonly hasErrorPart: { current: number }
}>("field")
