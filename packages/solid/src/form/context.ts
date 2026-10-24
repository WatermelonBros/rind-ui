import type { FormBinding } from "@rind-ui/core/internal"
import { createContext, useContext } from "solid-js"

export type { FormBinding }
export const FormContext = createContext<FormBinding | null>(null)

/** The enclosing Form, or null (a Field works in a plain `<form>` too). */
export const useFormBinding = (): FormBinding | null => useContext(FormContext)
