import type { FormBinding } from "@rind-ui/core/internal"
import { type InjectionKey, inject } from "vue"

export type { FormBinding }
export const FormKey: InjectionKey<FormBinding | null> = Symbol("rind-ui.form")

/** The enclosing Form, or null (a Field works in a plain `<form>` too). */
export const useFormBinding = (): FormBinding | null => inject(FormKey, null)
