import { type FieldsetScope, scopeDisabled } from "@rind-ui/core"
import { type Accessor, createContext, useContext } from "solid-js"

/** The disabled scope of the enclosing Fieldsets (crosses portals: Solid context). */
export const FieldsetScopeContext = createContext<Accessor<FieldsetScope | null>>()

/** Whether an enclosing rind-ui Fieldset disables this position (first-legend rule applied). */
export function useFieldsetDisabled(): Accessor<boolean> {
  const scope = useContext(FieldsetScopeContext)
  return () => scopeDisabled(scope?.() ?? null)
}
