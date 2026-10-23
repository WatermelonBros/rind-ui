import { type FieldsetScope, scopeDisabled } from "@rind-ui/core"
import { type ComputedRef, computed, type InjectionKey, inject } from "vue"

/** The disabled scope of the enclosing Fieldsets (crosses teleports: Vue injection). */
export const FieldsetScopeKey: InjectionKey<ComputedRef<FieldsetScope | null>> =
  Symbol("rind-ui.fieldset-scope")

/** Whether an enclosing rind-ui Fieldset disables this position (first-legend rule applied). */
export function useFieldsetDisabled(): ComputedRef<boolean> {
  const scope = inject(FieldsetScopeKey, null)
  return computed(() => scopeDisabled(scope?.value ?? null))
}
