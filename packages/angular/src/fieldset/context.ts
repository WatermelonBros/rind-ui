import { computed, InjectionToken, inject, type Signal } from "@angular/core"
import { type FieldsetScope, scopeDisabled } from "@rind-ui/core"

/** The disabled scope of the enclosing Fieldsets (crosses portals: Angular injection). */
export const FIELDSET_SCOPE = new InjectionToken<Signal<FieldsetScope | null>>(
  "rind-ui.fieldset-scope",
)

/** Whether an enclosing rind-ui Fieldset disables this position (first-legend rule applied). */
export function injectFieldsetDisabled(): Signal<boolean> {
  const scope = inject(FIELDSET_SCOPE, { optional: true })
  return computed(() => scopeDisabled(scope?.() ?? null))
}
