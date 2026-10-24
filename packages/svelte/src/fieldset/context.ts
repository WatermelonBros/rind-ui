import { type FieldsetScope, scopeDisabled } from "@rind-ui/core"
import { createContext } from "../context"

/** The disabled scope of the enclosing Fieldsets, read through a getter. */
export const fieldsetScope = createContext<() => FieldsetScope | null>("fieldset-scope")

/** Whether an enclosing rind-ui Fieldset disables this position (first-legend rule applied). */
export function useFieldsetDisabled(): () => boolean {
  const scope = fieldsetScope.maybe()
  return () => scopeDisabled(scope?.() ?? null)
}
