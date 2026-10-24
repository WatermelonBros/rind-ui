import { InjectionToken, inject } from "@angular/core"
import type { FormBinding } from "@rind-ui/core/internal"

export type { FormBinding }

/** The enclosing rind-ui Form (provided by its Root). */
export const FORM = new InjectionToken<FormBinding>("rind-ui.form")

/** The enclosing Form, or null (a Field works in a plain `<form>` too). */
export const injectFormBinding = (): FormBinding | null => inject(FORM, { optional: true })
